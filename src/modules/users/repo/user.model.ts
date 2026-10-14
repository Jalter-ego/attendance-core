import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { Tenant } from '../../tenants/repo/tenant.model';

export type UserRole = 'owner' | 'admin' | 'superadmin';

@Table({ tableName: 'users', underscored: true })
export class User extends Model {
  @Column({ type: DataType.UUID, primaryKey: true, defaultValue: DataType.UUIDV4 })
  id: string;

  // NULL solo para el super-admin de la plataforma
  @ForeignKey(() => Tenant)
  @Column({ type: DataType.UUID, allowNull: true })
  tenantId: string | null;

  @Column({ type: DataType.STRING(150), allowNull: false })
  name: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  email: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  passwordHash: string;

  @Column({ type: DataType.STRING(20), allowNull: false, defaultValue: 'admin' })
  role: UserRole;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  isActive: boolean;

  @Column({ type: DataType.DATE, allowNull: true })
  lastLoginAt: Date | null;

  @BelongsTo(() => Tenant)
  tenant: Tenant | null;
}
