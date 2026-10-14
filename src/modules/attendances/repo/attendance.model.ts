import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { AcademicModule } from '../../academic-modules/repo/academic-module.model';
import { ClassSession } from '../../class-sessions/repo/class-session.model';
import { Student } from '../../students/repo/student.model';
import { Tenant } from '../../tenants/repo/tenant.model';
import { User } from '../../users/repo/user.model';

export type AttendanceStatus = 'present' | 'absent';
export type AttendanceSource = 'student' | 'admin';

// Una fecha pasada sin fila cuenta como Falta (RN-05)
@Table({ tableName: 'attendances', underscored: true })
export class Attendance extends Model {
  @Column({ type: DataType.UUID, primaryKey: true, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => Tenant)
  @Column({ type: DataType.UUID, allowNull: false })
  tenantId: string;

  @ForeignKey(() => AcademicModule)
  @Column({ type: DataType.UUID, allowNull: false })
  moduleId: string;

  @ForeignKey(() => Student)
  @Column({ type: DataType.UUID, allowNull: false })
  studentId: string;

  @ForeignKey(() => ClassSession)
  @Column({ type: DataType.UUID, allowNull: false })
  classSessionId: string;

  @Column({ type: DataType.STRING(20), allowNull: false, defaultValue: 'present' })
  status: AttendanceStatus;

  // Hora real de la marca del estudiante (RF-03)
  @Column({ type: DataType.DATE, allowNull: true })
  markedAt: Date | null;

  @Column({ type: DataType.STRING(20), allowNull: false, defaultValue: 'student' })
  source: AttendanceSource;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: true })
  updatedBy: string | null;

  @BelongsTo(() => Student)
  student: Student;

  @BelongsTo(() => ClassSession)
  classSession: ClassSession;

  @BelongsTo(() => User, 'updatedBy')
  updater: User | null;
}
