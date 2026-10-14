import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { ClassSession } from '../class-sessions/repo/class-session.model';
import { Student } from '../students/repo/student.model';
import { AcademicModulesController } from './academic-modules.controller';
import { AcademicModule } from './repo/academic-module.model';
import { AcademicModulesService } from './repo/academic-module.service';

@Module({
  imports: [SequelizeModule.forFeature([AcademicModule, Student, ClassSession]), ActivityLogsModule],
  controllers: [AcademicModulesController],
  providers: [AcademicModulesService],
  exports: [SequelizeModule, AcademicModulesService],
})
export class AcademicModulesModule {}
