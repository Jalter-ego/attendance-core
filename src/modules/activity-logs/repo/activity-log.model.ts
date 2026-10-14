import { Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { AcademicModule } from '../../academic-modules/repo/academic-module.model';
import { Tenant } from '../../tenants/repo/tenant.model';

export type ActorType = 'admin' | 'student' | 'system';

export type ActivityAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'ATTENDANCE_MARKED'
  | 'ATTENDANCE_UPDATED'
  | 'STUDENTS_IMPORTED'
  | 'SESSIONS_IMPORTED'
  | 'MODULE_ACTIVATED';

// Solo inserción: no tiene updated_at
@Table({ tableName: 'activity_logs', underscored: true, updatedAt: false })
export class ActivityLog extends Model {
  @Column({ type: DataType.UUID, primaryKey: true, defaultValue: DataType.UUIDV4 })
  id: string;

  // NULL en acciones del super-admin de la plataforma
  @ForeignKey(() => Tenant)
  @Column({ type: DataType.UUID, allowNull: true })
  tenantId: string | null;

  // NULL en acciones sin módulo, como un login sin módulo activo
  @ForeignKey(() => AcademicModule)
  @Column({ type: DataType.UUID, allowNull: true })
  moduleId: string | null;

  @Column({ type: DataType.STRING(20), allowNull: false })
  actorType: ActorType;

  // users.id o students.id según actorType, por eso sin FK
  @Column({ type: DataType.UUID, allowNull: true })
  actorId: string | null;

  @Column({ type: DataType.STRING(50), allowNull: false })
  action: ActivityAction;

  @Column({ type: DataType.STRING(50), allowNull: true })
  entityType: string | null;

  @Column({ type: DataType.UUID, allowNull: true })
  entityId: string | null;

  @Column({ type: DataType.JSONB, allowNull: true })
  oldValue: Record<string, unknown> | null;

  @Column({ type: DataType.JSONB, allowNull: true })
  newValue: Record<string, unknown> | null;

  @Column({ type: DataType.INET, allowNull: true })
  ip: string | null;
}
