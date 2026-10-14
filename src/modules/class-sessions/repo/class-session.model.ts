import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import { AcademicModule } from '../../academic-modules/repo/academic-module.model';
import { Attendance } from '../../attendances/repo/attendance.model';
import { Tenant } from '../../tenants/repo/tenant.model';

@Table({ tableName: 'class_sessions', underscored: true })
export class ClassSession extends Model {
  @Column({ type: DataType.UUID, primaryKey: true, defaultValue: DataType.UUIDV4 })
  id: string;

  @ForeignKey(() => Tenant)
  @Column({ type: DataType.UUID, allowNull: false })
  tenantId: string;

  @ForeignKey(() => AcademicModule)
  @Column({ type: DataType.UUID, allowNull: false })
  moduleId: string;

  // 'YYYY-MM-DD'
  @Column({ type: DataType.DATEONLY, allowNull: false })
  classDate: string;

  // Informativas: la marca se habilita por fecha, no por hora (RF-12)
  @Column({ type: DataType.TIME, allowNull: false })
  startTime: string;

  @Column({ type: DataType.TIME, allowNull: false })
  endTime: string;

  @BelongsTo(() => AcademicModule)
  module: AcademicModule;

  @HasMany(() => Attendance)
  attendances: Attendance[];
}
