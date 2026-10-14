import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { literal, Op, Transaction, WhereOptions } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AcademicModule } from '../../academic-modules/repo/academic-module.model';
import { Attendance } from '../../attendances/repo/attendance.model';
import { AdminPrincipal } from '../../auth/types/auth-principal';
import { Student } from '../../students/repo/student.model';
import { TenantsService } from '../../tenants/repo/tenant.service';
import { User } from '../../users/repo/user.model';
import { ListActivityLogsQuery } from '../dto/list-activity-logs.query';
import { ActivityAction, ActivityLog, ActorType } from './activity-log.model';

export interface RecordActivityInput {
  tenantId: string | null;
  moduleId?: string | null;
  actorType: ActorType;
  actorId?: string | null;
  action: ActivityAction;
  entityType?: string | null;
  entityId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ip?: string | null;
}

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectModel(ActivityLog) private readonly activityLogModel: typeof ActivityLog,
    @InjectModel(AcademicModule) private readonly academicModuleModel: typeof AcademicModule,
    @InjectModel(Attendance) private readonly attendanceModel: typeof Attendance,
    @InjectModel(Student) private readonly studentModel: typeof Student,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly tenants: TenantsService,
  ) {}

  // RF-09: registra una acción. Pasa la transacción si la acción forma parte de una
  record(input: RecordActivityInput, transaction?: Transaction): Promise<ActivityLog> {
    return this.activityLogModel.create({ ...input }, { transaction });
  }

  // RF-10: historial del módulo activo, del más reciente al más antiguo
  async list(admin: AdminPrincipal, query: ListActivityLogsQuery) {
    const module = await this.academicModuleModel.findOne({ where: { tenantId: admin.tenantId, status: 'active' } });
    if (!module) {
      throw new NotFoundException('No hay un módulo activo');
    }

    // Acciones del módulo, más las que no tienen módulo (como el login del admin) desde que se activó
    const conditions: WhereOptions<ActivityLog>[] = [
      {
        [Op.or]: [
          { moduleId: module.id },
          { moduleId: null, createdAt: { [Op.gte]: module.activatedAt ?? module.createdAt } },
        ],
      },
    ];

    if (query.studentId) {
      // Lo que hizo el estudiante y lo que se hizo sobre sus asistencias
      const attendanceIds = (
        await this.attendanceModel.findAll({ where: { studentId: query.studentId }, attributes: ['id'] })
      ).map((a) => a.id);
      conditions.push({
        [Op.or]: [
          { actorType: 'student', actorId: query.studentId },
          { entityType: 'student', entityId: query.studentId },
          { entityType: 'attendance', entityId: { [Op.in]: attendanceIds } },
        ],
      });
    }

    if (query.date) {
      // El día se interpreta en la zona horaria del tenant
      const timezone = this.sequelize.escape(await this.tenants.timezoneOf(admin.tenantId));
      conditions.push(
        literal(`("ActivityLog"."created_at" AT TIME ZONE ${timezone})::date = ${this.sequelize.escape(query.date)}`),
      );
    }

    const { rows, count } = await this.activityLogModel.findAndCountAll({
      where: { tenantId: admin.tenantId, [Op.and]: conditions },
      order: [['createdAt', 'DESC']],
      limit: query.limit,
      offset: query.offset,
    });

    const names = await this.actorNames(rows);
    return {
      total: count,
      limit: query.limit,
      offset: query.offset,
      items: rows.map((log) => ({
        id: log.id,
        createdAt: log.createdAt,
        action: log.action,
        actor: {
          type: log.actorType,
          id: log.actorId,
          name: log.actorId ? (names.get(log.actorId) ?? null) : null,
        },
        entityType: log.entityType,
        entityId: log.entityId,
        oldValue: log.oldValue,
        newValue: log.newValue,
        ip: log.ip,
      })),
    };
  }

  // Nombres de los admins y estudiantes que aparecen en la página
  private async actorNames(logs: ActivityLog[]): Promise<Map<string, string>> {
    const idsOf = (type: ActorType) => [
      ...new Set(logs.filter((l) => l.actorType === type && l.actorId).map((l) => l.actorId!)),
    ];
    const [users, students] = await Promise.all([
      this.userModel.findAll({ where: { id: { [Op.in]: idsOf('admin') } }, attributes: ['id', 'name'] }),
      this.studentModel.findAll({ where: { id: { [Op.in]: idsOf('student') } }, attributes: ['id', 'fullName'] }),
    ]);
    return new Map([
      ...users.map((u) => [u.id, u.name] as const),
      ...students.map((s) => [s.id, s.fullName] as const),
    ]);
  }
}
