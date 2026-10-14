import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import { ClassSession } from '../../class-sessions/repo/class-session.model';
import { Student } from '../../students/repo/student.model';
import { Tenant } from '../../tenants/repo/tenant.model';
import { User } from '../../users/repo/user.model';

export type AcademicModuleStatus = 'draft' | 'active' | 'archived';

// Tabla `modules`: se llama AcademicModule para no confundirla con los módulos de Nest
@Table({ tableName: 'modules', underscored: true })
export class AcademicModule extends Model {
  @Column({ type: DataType.UUID, primaryKey: true, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => Tenant)
  @Column({ type: DataType.UUID, allowNull: false })
  tenantId: string;

  @Column({ type: DataType.STRING(150), allowNull: false })
  name: string;

  @Column({ type: DataType.STRING(20), allowNull: false, defaultValue: 'draft' })
  status: AcademicModuleStatus;

  @Column({ type: DataType.DATE, allowNull: true })
  activatedAt: Date | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: true })
  activatedBy: string | null;

  @Column({ type: DataType.DATE, allowNull: true })
  archivedAt: Date | null;

  @BelongsTo(() => Tenant)
  tenant: Tenant;

  @BelongsTo(() => User, 'activatedBy')
  activator: User | null;

  @HasMany(() => Student)
  students: Student[];

  @HasMany(() => ClassSession)
  classSessions: ClassSession[];
}
