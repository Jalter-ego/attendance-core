import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AcademicModule } from '../academic-modules/repo/academic-module.model';
import { Attendance } from '../attendances/repo/attendance.model';
import { Student } from '../students/repo/student.model';
import { TenantsModule } from '../tenants/tenants.module';
import { User } from '../users/repo/user.model';
import { ActivityLogsController } from './activity-logs.controller';
import { ActivityLog } from './repo/activity-log.model';
import { ActivityLogsService } from './repo/activity-log.service';

// Solo registra modelos de otros dominios (sin importar sus módulos), para no crear dependencias circulares
@Module({
  imports: [SequelizeModule.forFeature([ActivityLog, AcademicModule, Attendance, Student, User]), TenantsModule],
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService],
  exports: [SequelizeModule, ActivityLogsService],
})
export class ActivityLogsModule {}
