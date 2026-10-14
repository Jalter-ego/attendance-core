import { Column, DataType, HasMany, Model, Table } from 'sequelize-typescript';
import { AcademicModule } from '../../academic-modules/repo/academic-module.model';
import { User } from '../../users/repo/user.model';

export type TenantStatus = 'active' | 'suspended';

@Table({ tableName: 'tenants', underscored: true })
export class Tenant extends Model {
  @Column({ type: DataType.UUID, primaryKey: true, defaultValue: DataType.UUIDV4 })
  id: string;

  @Column({ type: DataType.STRING(150), allowNull: false })
  name: string;

  @Column({ type: DataType.STRING(60), allowNull: false, unique: true })
  slug: string;

  @Column({ type: DataType.STRING(64), allowNull: false, defaultValue: 'America/La_Paz' })
  timezone: string;

  @Column({ type: DataType.STRING(20), allowNull: false, defaultValue: 'active' })
  status: TenantStatus;

  @HasMany(() => User)
  users: User[];

  @HasMany(() => AcademicModule)
  modules: AcademicModule[];
}
