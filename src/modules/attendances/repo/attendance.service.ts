import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { AcademicModule } from '../../academic-modules/repo/academic-module.model';
import { ActivityLogsService } from '../../activity-logs/repo/activity-log.service';
import { StudentPrincipal } from '../../auth/types/auth-principal';
import { ClassSession } from '../../class-sessions/repo/class-session.model';
import { toSessionView } from '../../class-sessions/repo/class-session.view';
import { TenantsService } from '../../tenants/repo/tenant.service';
import { countStatuses, resolveSessionStatus } from './attendance-status';
import { Attendance } from './attendance.model';

// Asistencia desde el lado del estudiante (RF-03, RF-04, RF-05)
@Injectable()
export class AttendancesService {
  constructor(
    @InjectModel(Attendance) private readonly attendanceModel: typeof Attendance,
    @InjectModel(ClassSession) private readonly classSessionModel: typeof ClassSession,
    @InjectModel(AcademicModule) private readonly academicModuleModel: typeof AcademicModule,
    private readonly tenants: TenantsService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  // Para el botón de marcar: si hoy hay clase y si ya marcó
  async today(student: StudentPrincipal) {
    const today = await this.tenants.todayFor(student.tenantId);
    const session = await this.classSessionModel.findOne({
      where: { moduleId: student.moduleId, classDate: today },
    });
    const attendance = session
      ? await this.attendanceModel.findOne({ where: { studentId: student.sub, classSessionId: session.id } })
      : null;

    return {
      date: today,
      session: session ? toSessionView(session) : null,
      canMark: session !== null && attendance === null,
      attendance: attendance ? { status: attendance.status, markedAt: attendance.markedAt } : null,
    };
  }

  // RF-03: una sola marca por estudiante y fecha de clase, y solo el día de la clase (RN-03, RN-04)
  async markToday(student: StudentPrincipal, ip: string) {
    const today = await this.tenants.todayFor(student.tenantId);
    const session = await this.classSessionModel.findOne({
      where: { moduleId: student.moduleId, classDate: today },
    });
    if (!session) {
      throw new UnprocessableEntityException('Hoy no hay clase programada. Solo puedes marcar en una fecha de clase');
    }

    let attendance: Attendance;
    try {
      attendance = await this.attendanceModel.create({
        tenantId: student.tenantId,
        moduleId: student.moduleId,
        studentId: student.sub,
        classSessionId: session.id,
        status: 'present',
        source: 'student',
        markedAt: new Date(),
      });
    } catch (error) {
      // También cubre una corrección del admin hecha antes en esta misma fecha
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException('Ya hay una asistencia registrada para hoy');
      }
      throw error;
    }

    await this.activityLogs.record({
      tenantId: student.tenantId,
      moduleId: student.moduleId,
      actorType: 'student',
      actorId: student.sub,
      action: 'ATTENDANCE_MARKED',
      entityType: 'attendance',
      entityId: attendance.id,
      newValue: { status: 'present', classDate: session.classDate, markedAt: attendance.markedAt },
      ip,
    });

    return {
      id: attendance.id,
      status: attendance.status,
      markedAt: attendance.markedAt,
      session: toSessionView(session),
    };
  }

  // RF-05: todas las fechas del módulo con su estado y un resumen
  async myHistory(student: StudentPrincipal) {
    const [module, today, sessions, attendances] = await Promise.all([
      this.academicModuleModel.findByPk(student.moduleId),
      this.tenants.todayFor(student.tenantId),
      this.classSessionModel.findAll({ where: { moduleId: student.moduleId }, order: [['classDate', 'ASC']] }),
      this.attendanceModel.findAll({ where: { studentId: student.sub, moduleId: student.moduleId } }),
    ]);
    if (!module) {
      throw new NotFoundException('El módulo no existe');
    }

    const bySession = new Map(attendances.map((a) => [a.classSessionId, a]));
    const rows = sessions.map((session) => {
      const attendance = bySession.get(session.id) ?? null;
      const status = resolveSessionStatus(session.classDate, today, attendance?.status ?? null);
      return {
        ...toSessionView(session),
        status,
        // Solo las marcas hechas por el estudiante tienen hora
        markedAt: status === 'present' ? (attendance?.markedAt ?? null) : null,
      };
    });

    return {
      module: { id: module.id, name: module.name },
      today,
      summary: countStatuses(rows),
      sessions: rows,
    };
  }
}
