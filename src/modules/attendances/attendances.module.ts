import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AcademicModulesModule } from '../academic-modules/academic-modules.module';
import { AcademicModule } from '../academic-modules/repo/academic-module.model';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { ClassSession } from '../class-sessions/repo/class-session.model';
import { Student } from '../students/repo/student.model';
import { TenantsModule } from '../tenants/tenants.module';
import { AttendanceAdminController } from './attendance-admin.controller';
import { AttendancesController } from './attendances.controller';
import { AttendanceAdminService } from './repo/attendance-admin.service';
import { Attendance } from './repo/attendance.model';
import { AttendancesService } from './repo/attendance.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Attendance, ClassSession, AcademicModule, Student]),
    AcademicModulesModule,
    ActivityLogsModule,
    TenantsModule,
  ],
  controllers: [AttendancesController, AttendanceAdminController],
  providers: [AttendancesService, AttendanceAdminService],
  exports: [SequelizeModule, AttendancesService],
})
export class AttendancesModule {}
