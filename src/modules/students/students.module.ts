import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AcademicModulesModule } from '../academic-modules/academic-modules.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { Student } from './repo/student.model';
import { StudentsService } from './repo/student.service';
import { StudentsController } from './students.controller';

@Module({
  imports: [SequelizeModule.forFeature([Student]), AcademicModulesModule, ActivityLogsModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [SequelizeModule, StudentsService],
})
export class StudentsModule {}
