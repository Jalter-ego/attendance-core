import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { readExcelSheet } from '../../../common/excel/excel-reader';
import { rethrowExcelReadError, throwImportErrors } from '../../../common/excel/excel-upload';
import { AcademicModulesService } from '../../academic-modules/repo/academic-module.service';
import { ActivityLogsService } from '../../activity-logs/repo/activity-log.service';
import { AdminPrincipal } from '../../auth/types/auth-principal';
import { parseSessionRows, SESSION_COLUMNS } from './class-session-import.parser';
import { ClassSession } from './class-session.model';

@Injectable()
export class ClassSessionsService {
  constructor(
    @InjectModel(ClassSession) private readonly classSessionModel: typeof ClassSession,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly academicModules: AcademicModulesService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  // RF-12: reemplaza las fechas del borrador por las del archivo. Si hay errores no guarda nada
  async importForModule(admin: AdminPrincipal, moduleId: string, file: Express.Multer.File, ip: string) {
    await this.academicModules.findDraftOrFail(admin.tenantId, moduleId);

    const sheet = await readExcelSheet(file.buffer, SESSION_COLUMNS).catch(rethrowExcelReadError);
    if (sheet.errors.length > 0) throwImportErrors(sheet.errors);

    const { sessions, errors } = parseSessionRows(sheet.rows);
    if (errors.length > 0) throwImportErrors(errors);
    if (sessions.length === 0) {
      throw new UnprocessableEntityException({ message: 'El archivo no tiene fechas de clase', errors: [] });
    }

    await this.sequelize.transaction(async (transaction) => {
      await this.academicModules.findDraftOrFail(admin.tenantId, moduleId, transaction);
      await this.classSessionModel.destroy({ where: { moduleId }, transaction });
      await this.classSessionModel.bulkCreate(
        sessions.map((session) => ({ ...session, tenantId: admin.tenantId, moduleId })),
        { transaction },
      );
      await this.activityLogs.record(
        {
          tenantId: admin.tenantId,
          moduleId,
          actorType: 'admin',
          actorId: admin.sub,
          action: 'SESSIONS_IMPORTED',
          entityType: 'module',
          entityId: moduleId,
          newValue: { fileName: file.originalname, rows: sessions.length },
          ip,
        },
        transaction,
      );
    });

    return { imported: sessions.length };
  }
}
