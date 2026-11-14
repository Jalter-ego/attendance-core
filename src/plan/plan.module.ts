import { Global, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AcademicModule } from '../modules/academic-modules/repo/academic-module.model';
import { Student } from '../modules/students/repo/student.model';
import { User } from '../modules/users/repo/user.model';
import { PlanLimitsService } from './plan-limits.service';
import { PlanController } from './plan.controller';
import { PlanUsageService } from './plan-usage.service';

@Global()
@Module({
  imports: [SequelizeModule.forFeature([User, AcademicModule, Student])],
  controllers: [PlanController],
  providers: [PlanLimitsService, PlanUsageService],
  exports: [PlanLimitsService],
})
export class PlanModule {}
