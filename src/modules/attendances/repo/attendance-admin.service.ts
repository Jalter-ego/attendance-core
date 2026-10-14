import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Op, UniqueConstraintError } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AcademicModulesService } from '../../academic-modules/repo/academic-module.service';
import { ActivityLogsService } from '../../activity-logs/repo/activity-log.service';
import { AdminPrincipal } from '../../auth/types/auth-principal';
import { ClassSession } from '../../class-sessions/repo/class-session.model';
import { toSessionView } from '../../class-sessions/repo/class-session.view';
import { Student } from '../../students/repo/student.model';
import { TenantsService } from '../../tenants/repo/tenant.service';
import { toFileSlug } from '../../../common/excel/excel-writer';
import { AttendanceOverviewQuery } from '../dto/attendance-overview.query';
import { UpdateAttendanceDto } from '../dto/update-attendance.dto';
import { buildAttendanceWorkbook } from './attendance-export';
import { countStatuses, resolveSessionStatus, SessionAttendanceStatus } from './attendance-status';
import { Attendance } from './attendance.model';

const studentView = (s: Student) => ({ id: s.id, registrationNumber: s.registrationNumber, fullName: s.fullName });

// Asistencia desde el lado del admin (RF-07, RF-08)
@Injectable()
export class AttendanceAdminService {
  constructor(
    @InjectModel(Attendance) private readonly attendanceModel: typeof Attendance,
    @InjectModel(ClassSession) private readonly classSessionModel: typeof ClassSession,
    @InjectModel(Student) private readonly studentModel: typeof Student,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly academicModules: AcademicModulesService,
    private readonly tenants: TenantsService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  // Carga común de la vista general: la usan la consulta (RF-08) y el export (RF-17)
  private async loadOverview(admin: AdminPrincipal, query: AttendanceOverviewQuery) {
    const module = await this.academicModules.requireActive(admin.tenantId);
    const [today, sessions, students] = await Promise.all([
      this.tenants.todayFor(admin.tenantId),
      this.classSessionModel.findAll({
        where: { moduleId: module.id, ...(query.date ? { classDate: query.date } : {}) },
        order: [['classDate', 'ASC']],
      }),
      this.studentModel.findAll({
        where: { moduleId: module.id, ...(query.studentId ? { id: query.studentId } : {}) },
        order: [['fullName', 'ASC']],
      }),
    ]);
    if (query.date && sessions.length === 0) {
      throw new NotFoundException(`No hay clase programada el ${query.date}`);
    }
    if (query.studentId && students.length === 0) {
      throw new NotFoundException('El estudiante no pertenece al módulo activo');
    }

    const attendances = await this.attendanceModel.findAll({
      where: {
        moduleId: module.id,
        classSessionId: { [Op.in]: sessions.map((s) => s.id) },
        studentId: { [Op.in]: students.map((s) => s.id) },
      },
    });
    const recorded = new Map(attendances.map((a) => [`${a.studentId}:${a.classSessionId}`, a]));

    // Estado y hora de cada cruce estudiante × fecha
    const cells = new Map<string, { status: SessionAttendanceStatus; markedAt: Date | null }>();
    for (const session of sessions) {
      for (const student of students) {
        const key = `${student.id}:${session.id}`;
        const attendance = recorded.get(key) ?? null;
        const status = resolveSessionStatus(session.classDate, today, attendance?.status ?? null);
        cells.set(key, {
          status,
          markedAt: status === 'present' ? (attendance?.markedAt ?? null) : null,
        });
      }
    }

    return { module, today, sessions, students, recorded, cells };
  }

  // RF-08: asistencia de todos los estudiantes, filtrable por fecha y por estudiante, con totales
  async overview(admin: AdminPrincipal, query: AttendanceOverviewQuery) {
    const { module, today, sessions, students, recorded, cells } = await this.loadOverview(admin, query);

    const records = sessions.flatMap((session) =>
      students.map((student) => {
        const key = `${student.id}:${session.id}`;
        const cell = cells.get(key)!;
        return {
          student: studentView(student),
          session: toSessionView(session),
          status: cell.status,
          markedAt: cell.markedAt,
          source: recorded.get(key)?.source ?? null,
        };
      }),
    );

    return {
      module: { id: module.id, name: module.name },
      today,
      filters: { date: query.date ?? null, studentId: query.studentId ?? null },
      totals: countStatuses(records),
      records,
    };
  }

  // RF-17: la misma vista general como archivo .xlsx
  async exportOverview(admin: AdminPrincipal, query: AttendanceOverviewQuery) {
    const { module, today, sessions, students, cells } = await this.loadOverview(admin, query);

    const buffer = await buildAttendanceWorkbook({
      moduleName: module.name,
      today,
      // Con filtro de estudiante hay uno solo: se nombra en la hoja
      filters: {
        date: query.date ?? null,
        studentName: query.studentId ? (students[0]?.fullName ?? null) : null,
      },
      students,
      sessions,
      cells,
    });

    const parts = ['asistencias', toFileSlug(module.name, 'modulo'), query.date ?? today];
    return { buffer, filename: `${parts.join('-')}.xlsx` };
  }

  // RF-07: cambia Presente/Falta en cualquier fecha del módulo activo, incluso pasada. Queda auditado (RN-07)
  async update(admin: AdminPrincipal, dto: UpdateAttendanceDto, ip: string) {
    const module = await this.academicModules.requireActive(admin.tenantId);
    const today = await this.tenants.todayFor(admin.tenantId);

    try {
      return await this.sequelize.transaction(async (transaction) => {
        const [student, session] = await Promise.all([
          this.studentModel.findOne({ where: { id: dto.studentId, moduleId: module.id }, transaction }),
          this.classSessionModel.findOne({ where: { id: dto.classSessionId, moduleId: module.id }, transaction }),
        ]);
        if (!student) throw new NotFoundException('El estudiante no pertenece al módulo activo');
        if (!session) throw new NotFoundException('La fecha de clase no pertenece al módulo activo');

        const existing = await this.attendanceModel.findOne({
          where: { studentId: student.id, classSessionId: session.id },
          lock: transaction.LOCK.UPDATE,
          transaction,
        });
        const previousStatus = resolveSessionStatus(session.classDate, today, existing?.status ?? null);

        const view = (attendance: Attendance | null, changed: boolean) => ({
          changed,
          previousStatus,
          status: dto.status,
          student: studentView(student),
          session: toSessionView(session),
          markedAt: dto.status === 'present' ? (attendance?.markedAt ?? null) : null,
        });

        // Sin cambio real, por ejemplo Falta en una fecha pasada sin marca: no se crea ni se audita nada
        if (previousStatus === dto.status) {
          return view(existing, false);
        }

        // markedAt se conserva: solo refleja la marca real del estudiante
        const attendance = existing
          ? await existing.update({ status: dto.status, source: 'admin', updatedBy: admin.sub }, { transaction })
          : await this.attendanceModel.create(
              {
                tenantId: admin.tenantId,
                moduleId: module.id,
                studentId: student.id,
                classSessionId: session.id,
                status: dto.status,
                source: 'admin',
                markedAt: null,
                updatedBy: admin.sub,
              },
              { transaction },
            );

        await this.activityLogs.record(
          {
            tenantId: admin.tenantId,
            moduleId: module.id,
            actorType: 'admin',
            actorId: admin.sub,
            action: 'ATTENDANCE_UPDATED',
            entityType: 'attendance',
            entityId: attendance.id,
            oldValue: { status: previousStatus },
            newValue: {
              status: dto.status,
              studentId: student.id,
              registrationNumber: student.registrationNumber,
              classDate: session.classDate,
            },
            ip,
          },
          transaction,
        );

        return view(attendance, true);
      });
    } catch (error) {
      // El estudiante marcó justo mientras el admin creaba el registro
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException('La asistencia cambió mientras la editabas. Vuelve a intentarlo');
      }
      throw error;
    }
  }
}
