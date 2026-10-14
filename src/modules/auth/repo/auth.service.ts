import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import { compare } from 'bcryptjs';
import { col, fn, Op, where } from 'sequelize';
import { AcademicModule } from '../../academic-modules/repo/academic-module.model';
import { ActivityLogsService } from '../../activity-logs/repo/activity-log.service';
import { Student } from '../../students/repo/student.model';
import { Tenant } from '../../tenants/repo/tenant.model';
import { User } from '../../users/repo/user.model';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { StudentLoginDto } from '../dto/student-login.dto';
import { AdminPrincipal, AuthPrincipal, StudentPrincipal } from '../types/auth-principal';

const INVALID_ADMIN_CREDENTIALS = 'Correo o contraseña incorrectos';
const STUDENT_NOT_FOUND = 'Los datos no corresponden a un estudiante del módulo activo';

const lowerEquals = (column: string, value: string) =>
  where(fn('lower', col(column)), value.toLowerCase());

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Tenant) private readonly tenantModel: typeof Tenant,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(AcademicModule) private readonly academicModuleModel: typeof AcademicModule,
    @InjectModel(Student) private readonly studentModel: typeof Student,
    private readonly jwtService: JwtService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  // RF-02
  async loginAdmin(dto: AdminLoginDto, ip: string) {
    const tenant = await this.findActiveTenant(dto.tenant);
    const user = tenant
      ? await this.userModel.findOne({
          where: { tenantId: tenant.id, [Op.and]: [lowerEquals('email', dto.email)] },
        })
      : null;

    if (!tenant || !user || !user.isActive || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException(INVALID_ADMIN_CREDENTIALS);
    }

    await user.update({ lastLoginAt: new Date() });
    await this.activityLogs.record({
      tenantId: tenant.id,
      actorType: 'admin',
      actorId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      ip,
    });

    const principal: AdminPrincipal = {
      type: 'admin',
      sub: user.id,
      tenantId: tenant.id,
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(principal),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      tenant: this.tenantSummary(tenant),
    };
  }

  // RF-01: ingreso con correo o número de registro, solo del módulo activo
  async loginStudent(dto: StudentLoginDto, ip: string) {
    const tenant = await this.findActiveTenant(dto.tenant);
    if (!tenant) {
      throw new UnauthorizedException(STUDENT_NOT_FOUND);
    }

    const activeModule = await this.academicModuleModel.findOne({
      where: { tenantId: tenant.id, status: 'active' },
    });
    if (!activeModule) {
      throw new UnauthorizedException('No hay un módulo activo en este momento');
    }

    const student = await this.studentModel.findOne({
      where: {
        moduleId: activeModule.id,
        [Op.or]: [{ registrationNumber: dto.identifier }, lowerEquals('email', dto.identifier)],
      },
    });
    if (!student) {
      throw new UnauthorizedException(STUDENT_NOT_FOUND);
    }

    await this.activityLogs.record({
      tenantId: tenant.id,
      moduleId: activeModule.id,
      actorType: 'student',
      actorId: student.id,
      action: 'LOGIN',
      entityType: 'student',
      entityId: student.id,
      ip,
    });

    const principal: StudentPrincipal = {
      type: 'student',
      sub: student.id,
      tenantId: tenant.id,
      moduleId: activeModule.id,
    };

    return {
      accessToken: await this.jwtService.signAsync(principal),
      student: this.studentSummary(student),
      module: { id: activeModule.id, name: activeModule.name },
      tenant: this.tenantSummary(tenant),
    };
  }

  async me(principal: AuthPrincipal) {
    if (principal.type === 'admin') {
      const user = await this.userModel.findOne({
        where: { id: principal.sub, tenantId: principal.tenantId, isActive: true },
      });
      if (!user) {
        throw new NotFoundException('El usuario ya no existe o fue desactivado');
      }
      return { type: 'admin', user: { id: user.id, name: user.name, email: user.email, role: user.role } };
    }

    const student = await this.studentModel.findOne({
      where: { id: principal.sub, tenantId: principal.tenantId, moduleId: principal.moduleId },
    });
    if (!student) {
      throw new NotFoundException('El estudiante ya no pertenece al módulo activo');
    }
    return { type: 'student', student: this.studentSummary(student) };
  }

  // El JWT no se puede invalidar en el servidor: el cliente lo descarta. Aquí solo se registra la salida
  async logout(principal: AuthPrincipal, ip: string): Promise<void> {
    await this.activityLogs.record({
      tenantId: principal.tenantId,
      moduleId: principal.type === 'student' ? principal.moduleId : null,
      actorType: principal.type,
      actorId: principal.sub,
      action: 'LOGOUT',
      ip,
    });
  }

  private findActiveTenant(slug: string): Promise<Tenant | null> {
    return this.tenantModel.findOne({ where: { slug: slug.toLowerCase(), status: 'active' } });
  }

  private tenantSummary(tenant: Tenant) {
    return { id: tenant.id, name: tenant.name, slug: tenant.slug };
  }

  private studentSummary(student: Student) {
    return {
      id: student.id,
      registrationNumber: student.registrationNumber,
      fullName: student.fullName,
      email: student.email,
    };
  }
}
