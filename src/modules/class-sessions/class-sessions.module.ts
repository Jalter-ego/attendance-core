import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AcademicModulesModule } from '../academic-modules/academic-modules.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { ClassSessionsController } from './class-sessions.controller';
import { ClassSession } from './repo/class-session.model';
import { ClassSessionsService } from './repo/class-session.service';

@Module({
  imports: [SequelizeModule.forFeature([ClassSession]), AcademicModulesModule, ActivityLogsModule],
  controllers: [ClassSessionsController],
  providers: [ClassSessionsService],
  exports: [SequelizeModule, ClassSessionsService],
})
export class ClassSessionsModule {}
