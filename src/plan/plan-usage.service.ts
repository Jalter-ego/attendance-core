import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { AcademicModule } from '../modules/academic-modules/repo/academic-module.model';
import { Student } from '../modules/students/repo/student.model';
import { User } from '../modules/users/repo/user.model';
import { PlanLimitsService, PlanResource } from './plan-limits.service';

// Mismos criterios que las validaciones de límites: los módulos archivados no cuentan
const COUNTED_MODULE_STATUSES = ['draft', 'active'];

export interface ResourceUsage {
  used: number;
  limit: number | null;
  remaining: number | null;
}

@Injectable()
export class PlanUsageService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(AcademicModule) private readonly academicModuleModel: typeof AcademicModule,
    @InjectModel(Student) private readonly studentModel: typeof Student,
    private readonly planLimits: PlanLimitsService,
  ) {}

  async summary() {
    const [students, teachers, courses] = await Promise.all([
      this.studentModel.count({
        include: [
          {
            model: AcademicModule,
            attributes: [],
            required: true,
            where: { status: { [Op.in]: COUNTED_MODULE_STATUSES } },
          },
        ],
      }),
      this.userModel.count({ where: { isActive: true } }),
      this.academicModuleModel.count({ where: { status: { [Op.in]: COUNTED_MODULE_STATUSES } } }),
    ]);

    return {
      plan: { code: this.planLimits.plan, name: this.planLimits.planLabel },
      usage: {
        students: this.resource('students', students),
        teachers: this.resource('teachers', teachers),
        courses: this.resource('courses', courses),
      },
    };
  }

  private resource(resource: PlanResource, used: number): ResourceUsage {
    const limit = this.planLimits.limitOf(resource);
    return { used, limit, remaining: limit === null ? null : Math.max(limit - used, 0) };
  }
}
