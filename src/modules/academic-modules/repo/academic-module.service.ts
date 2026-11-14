import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Op, Transaction, UniqueConstraintError } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { PlanLimitsService } from '../../../plan/plan-limits.service';
import { ActivityLogsService } from '../../activity-logs/repo/activity-log.service';
import { AdminPrincipal } from '../../auth/types/auth-principal';
import { ClassSession } from '../../class-sessions/repo/class-session.model';
import { Student } from '../../students/repo/student.model';
import { AcademicModule } from './academic-module.model';

const VISIBLE_STATUSES = ['draft', 'active'];

@Injectable()
export class AcademicModulesService {
  constructor(
    @InjectModel(AcademicModule) private readonly academicModuleModel: typeof AcademicModule,
    @InjectModel(Student) private readonly studentModel: typeof Student,
    @InjectModel(ClassSession) private readonly classSessionModel: typeof ClassSession,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly activityLogs: ActivityLogsService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  async create(name: string) {
    if (this.planLimits.limitOf('courses') !== null) {
      const current = await this.academicModuleModel.count({ where: { status: { [Op.in]: VISIBLE_STATUSES } } });
      this.planLimits.assertWithinLimit('courses', current + 1);
    }
    const module = await this.academicModuleModel.create({ name, status: 'draft' });
    return this.summary(module, 0, 0);
  }

  async list() {
    const modules = await this.academicModuleModel.findAll({
      where: { status: { [Op.in]: VISIBLE_STATUSES } },
      order: [['createdAt', 'DESC']],
    });
    return Promise.all(modules.map(async (module) => this.summary(module, ...(await this.counts(module.id)))));
  }

  async findActive() {
    const module = await this.requireActive();
    return this.summary(module, ...(await this.counts(module.id)));
  }

  async requireActive(): Promise<AcademicModule> {
    const module = await this.academicModuleModel.findOne({ where: { status: 'active' } });
    if (!module) {
      throw new NotFoundException('No hay un módulo activo');
    }
    return module;
  }

  async findOne(id: string) {
    const module = await this.findVisible(id);
    const [students, sessions] = await Promise.all([
      this.studentModel.findAll({ where: { moduleId: id }, order: [['fullName', 'ASC']] }),
      this.classSessionModel.findAll({ where: { moduleId: id }, order: [['classDate', 'ASC']] }),
    ]);
    return {
      ...this.summary(module, students.length, sessions.length),
      students: students.map((s) => ({
        id: s.id,
        registrationNumber: s.registrationNumber,
        fullName: s.fullName,
        email: s.email,
      })),
      sessions: sessions.map((s) => ({
        id: s.id,
        classDate: s.classDate,
        startTime: s.startTime.slice(0, 5),
        endTime: s.endTime.slice(0, 5),
      })),
    };
  }

  
  async findDraftOrFail(id: string, transaction?: Transaction) {
    const module = await this.findVisible(id, transaction);
    if (module.status !== 'draft') {
      throw new ConflictException('Solo se pueden importar datos en un módulo en borrador');
    }
    return module;
  }

  countStudentsInOtherModules(moduleId: string, transaction?: Transaction): Promise<number> {
    return this.studentModel.count({
      include: [
        {
          model: AcademicModule,
          attributes: [],
          required: true,
          where: { id: { [Op.ne]: moduleId }, status: { [Op.in]: VISIBLE_STATUSES } },
        },
      ],
      transaction,
    });
  }

  async activate(admin: AdminPrincipal, id: string, ip: string) {
    try {
      return await this.sequelize.transaction(async (transaction) => {
        const module = await this.academicModuleModel.findOne({
          where: { id },
          lock: transaction.LOCK.UPDATE,
          transaction,
        });
        if (!module || module.status === 'archived') {
          throw new NotFoundException('El módulo no existe');
        }
        if (module.status === 'active') {
          throw new ConflictException('El módulo ya está activo');
        }

        const [studentsCount, sessionsCount] = await this.counts(id, transaction);
        if (studentsCount === 0 || sessionsCount === 0) {
          throw new UnprocessableEntityException(
            'Importa al menos un estudiante y una fecha de clase antes de activar el módulo',
          );
        }

        const now = new Date();
        const previous = await this.academicModuleModel.findOne({
          where: { status: 'active' },
          lock: transaction.LOCK.UPDATE,
          transaction,
        });
        if (previous) {
          await previous.update({ status: 'archived', archivedAt: now }, { transaction });
        }

        await module.update({ status: 'active', activatedAt: now, activatedBy: admin.sub }, { transaction });

        await this.activityLogs.record(
          {
            moduleId: module.id,
            actorType: 'admin',
            actorId: admin.sub,
            action: 'MODULE_ACTIVATED',
            entityType: 'module',
            entityId: module.id,
            oldValue: previous ? { activeModuleId: previous.id, activeModuleName: previous.name } : null,
            newValue: { activeModuleId: module.id, activeModuleName: module.name, studentsCount, sessionsCount },
            ip,
          },
          transaction,
        );

        return {
          ...this.summary(module, studentsCount, sessionsCount),
          archivedModule: previous ? { id: previous.id, name: previous.name } : null,
        };
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException('Otro módulo se activó al mismo tiempo. Vuelve a intentarlo');
      }
      throw error;
    }
  }

  private async findVisible(id: string, transaction?: Transaction) {
    const module = await this.academicModuleModel.findOne({
      where: { id, status: { [Op.in]: VISIBLE_STATUSES } },
      lock: transaction ? transaction.LOCK.UPDATE : undefined,
      transaction,
    });
    if (!module) {
      throw new NotFoundException('El módulo no existe');
    }
    return module;
  }

  private counts(moduleId: string, transaction?: Transaction): Promise<[number, number]> {
    return Promise.all([
      this.studentModel.count({ where: { moduleId }, transaction }),
      this.classSessionModel.count({ where: { moduleId }, transaction }),
    ]);
  }

  private summary(module: AcademicModule, studentsCount: number, sessionsCount: number) {
    return {
      id: module.id,
      name: module.name,
      status: module.status,
      activatedAt: module.activatedAt,
      createdAt: module.createdAt,
      studentsCount,
      sessionsCount,
    };
  }
}
