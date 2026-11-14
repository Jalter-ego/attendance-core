import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { escapeLike } from '../../../common/dto/query-transforms';
import { PlanLimitsService } from '../../../plan/plan-limits.service';
import { readExcelSheet } from '../../../common/excel/excel-reader';
import { rethrowExcelReadError, throwImportErrors } from '../../../common/excel/excel-upload';
import { AcademicModulesService } from '../../academic-modules/repo/academic-module.service';
import { ActivityLogsService } from '../../activity-logs/repo/activity-log.service';
import { AdminPrincipal } from '../../auth/types/auth-principal';
import { parseStudentRows, STUDENT_COLUMNS } from './student-import.parser';
import { Student } from './student.model';

@Injectable()
export class StudentsService {
  constructor(
    @InjectModel(Student) private readonly studentModel: typeof Student,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly academicModules: AcademicModulesService,
    private readonly activityLogs: ActivityLogsService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  // RF-06: estudiantes del módulo activo; busca por nombre (en cualquier parte) o por registro (desde el inicio)
  async listActive(admin: AdminPrincipal, search?: string) {
    const module = await this.academicModules.requireActive();

    const where: WhereOptions<Student> = { moduleId: module.id };
    if (search) {
      const term = escapeLike(search);
      Object.assign(where, {
        [Op.or]: [{ fullName: { [Op.iLike]: `%${term}%` } }, { registrationNumber: { [Op.iLike]: `${term}%` } }],
      });
    }

    const students = await this.studentModel.findAll({ where, order: [['fullName', 'ASC']] });
    return {
      module: { id: module.id, name: module.name },
      total: students.length,
      students: students.map((s) => ({
        id: s.id,
        registrationNumber: s.registrationNumber,
        fullName: s.fullName,
        email: s.email,
      })),
    };
  }

  // RF-11: reemplaza los estudiantes del borrador por los del archivo. Si hay errores no guarda nada
  async importForModule(admin: AdminPrincipal, moduleId: string, file: Express.Multer.File, ip: string) {
    await this.academicModules.findDraftOrFail(moduleId);

    const sheet = await readExcelSheet(file.buffer, STUDENT_COLUMNS).catch(rethrowExcelReadError);
    if (sheet.errors.length > 0) throwImportErrors(sheet.errors);

    const { students, errors } = parseStudentRows(sheet.rows);
    if (errors.length > 0) throwImportErrors(errors);
    if (students.length === 0) {
      throw new UnprocessableEntityException({ message: 'El archivo no tiene estudiantes', errors: [] });
    }

    await this.sequelize.transaction(async (transaction) => {
      await this.academicModules.findDraftOrFail(moduleId, transaction);

      // RF-05: el borrador se reemplaza, así que el total es lo de los demás módulos + el archivo
      if (this.planLimits.limitOf('students') !== null) {
        const others = await this.academicModules.countStudentsInOtherModules(moduleId, transaction);
        this.planLimits.assertWithinLimit('students', others + students.length);
      }

      await this.studentModel.destroy({ where: { moduleId }, transaction });
      await this.studentModel.bulkCreate(
        students.map((student) => ({ ...student, moduleId })),
        { transaction },
      );
      await this.activityLogs.record(
        {
          moduleId,
          actorType: 'admin',
          actorId: admin.sub,
          action: 'STUDENTS_IMPORTED',
          entityType: 'module',
          entityId: moduleId,
          newValue: { fileName: file.originalname, rows: students.length },
          ip,
        },
        transaction,
      );
    });

    return { imported: students.length };
  }
}
