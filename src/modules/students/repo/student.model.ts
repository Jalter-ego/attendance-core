import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import { AcademicModule } from '../../academic-modules/repo/academic-module.model';
import { Attendance } from '../../attendances/repo/attendance.model';
import { Tenant } from '../../tenants/repo/tenant.model';

@Table({ tableName: 'students', underscored: true })
export class Student extends Model {
  @Column({ type: DataType.UUID, primaryKey: true, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => Tenant)
  @Column({ type: DataType.UUID, allowNull: false })
  tenantId: string;

  @ForeignKey(() => AcademicModule)
  @Column({ type: DataType.UUID, allowNull: false })
  moduleId: string;

  @Column({ type: DataType.STRING(50), allowNull: false })
  registrationNumber: string;

  @Column({ type: DataType.STRING(200), allowNull: false })
  fullName: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  email: string;

  @BelongsTo(() => AcademicModule)
  module: AcademicModule;

  @HasMany(() => Attendance)
  attendances: Attendance[];
}
