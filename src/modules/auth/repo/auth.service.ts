import { InstitutionService } from '../../../institution/institution.service';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import { compare } from 'bcryptjs';
import { col, fn, Op, where } from 'sequelize';
import { AcademicModule } from '../../academic-modules/repo/academic-module.model';
import { ActivityLogsService } from '../../activity-logs/repo/activity-log.service';
import { Student } from '../../students/repo/student.model';
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
    private readonly institution: InstitutionService,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(AcademicModule) private readonly academicModuleModel: typeof AcademicModule,
    @InjectModel(Student) private readonly studentModel: typeof Student,
    private readonly jwtService: JwtService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  // RF-02
  async loginAdmin(dto: AdminLoginDto, ip: string) {
    const user = await this.userModel.findOne({
      where: { [Op.and]: [lowerEquals('email', dto.email)] },
    });

    if (!user || !user.isActive || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException(INVALID_ADMIN_CREDENTIALS);
    }

    await user.update({ lastLoginAt: new Date() });
    await this.activityLogs.record({
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
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(principal),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      institution: this.institution.summary(),
    };
  }

  // RF-01: ingreso con correo o número de registro, solo del módulo activo
  async loginStudent(dto: StudentLoginDto, ip: string) {
    const activeModule = await this.academicModuleModel.findOne({
      where: { status: 'active' },
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
      moduleId: activeModule.id,
    };

    return {
      accessToken: await this.jwtService.signAsync(principal),
      student: this.studentSummary(student),
      module: { id: activeModule.id, name: activeModule.name },
      institution: this.institution.summary(),
    };
  }

  async me(principal: AuthPrincipal) {
    if (principal.type === 'admin') {
      const user = await this.userModel.findOne({
        where: { id: principal.sub, isActive: true },
      });
      if (!user) {
        throw new NotFoundException('El usuario ya no existe o fue desactivado');
      }
      return { type: 'admin', institution: this.institution.summary(), user: { id: user.id, name: user.name, email: user.email, role: user.role } };
    }

    const student = await this.studentModel.findOne({
      where: { id: principal.sub, moduleId: principal.moduleId },
    });
    if (!student) {
      throw new NotFoundException('El estudiante ya no pertenece al módulo activo');
    }
    return { type: 'student', institution: this.institution.summary(), student: this.studentSummary(student) };
  }

  // El JWT no se puede invalidar en el servidor: el cliente lo descarta. Aquí solo se registra la salida
  async logout(principal: AuthPrincipal, ip: string): Promise<void> {
    await this.activityLogs.record({
      moduleId: principal.type === 'student' ? principal.moduleId : null,
      actorType: principal.type,
      actorId: principal.sub,
      action: 'LOGOUT',
      ip,
    });
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
