import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import { Request } from 'express';
import { AcademicModule } from '../../academic-modules/repo/academic-module.model';
import { UserRole } from '../../users/repo/user.model';
import { User } from '../../users/repo/user.model';
import { Student } from '../../students/repo/student.model';
import { ALLOWED_ROLES_KEY, ALLOWED_TYPES_KEY, IS_PUBLIC_KEY } from '../auth.decorators';
import { AuthPrincipal, PrincipalType, StudentPrincipal } from '../types/auth-principal';

// Guard global: toda ruta exige JWT salvo las marcadas con @Public()
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    @InjectModel(AcademicModule) private readonly academicModuleModel: typeof AcademicModule,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(Student) private readonly studentModel: typeof Student,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthPrincipal }>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Inicia sesión para continuar');
    }

    try {
      request.user = await this.jwtService.verifyAsync<AuthPrincipal>(token);
    } catch {
      throw new UnauthorizedException('La sesión venció o no es válida. Inicia sesión de nuevo');
    }

    const principal = request.user;
    if (!principal || typeof principal.sub !== 'string' || 'tenantId' in principal) {
      throw new UnauthorizedException('La sesión no pertenece a esta instalación');
    }
    if (principal.type === 'admin') {
      const user = await this.userModel.findOne({ where: { id: principal.sub, isActive: true } });
      if (!user || !['owner', 'admin'].includes(user.role)) {
        throw new UnauthorizedException('El usuario ya no está disponible');
      }
      // Los permisos actuales prevalecen sobre los guardados en un token anterior.
      principal.role = user.role;
    } else if (principal.type === 'student' && typeof principal.moduleId === 'string') {
      const student = await this.studentModel.findOne({
        where: { id: principal.sub, moduleId: principal.moduleId },
      });
      if (!student) throw new UnauthorizedException('El estudiante ya no está disponible');
    } else {
      throw new UnauthorizedException('La sesión no es válida');
    }

    // El token del estudiante deja de servir cuando se activa otro módulo (RF-13)
    if (request.user.type === 'student' && !(await this.isActiveModule(request.user))) {
      throw new UnauthorizedException('El módulo de esta sesión ya no está activo. Inicia sesión de nuevo');
    }

    const allowed = this.reflector.getAllAndOverride<PrincipalType[]>(ALLOWED_TYPES_KEY, targets);
    if (allowed && !allowed.includes(request.user.type)) {
      throw new ForbiddenException('No tienes permiso para realizar esta acción');
    }

    // Rutas que exigen un rol concreto dentro de la institución
    const allowedRoles = this.reflector.getAllAndOverride<UserRole[]>(ALLOWED_ROLES_KEY, targets);
    if (allowedRoles && (request.user.type !== 'admin' || !allowedRoles.includes(request.user.role))) {
      throw new ForbiddenException('No tienes permiso para realizar esta acción');
    }

    return true;
  }

  private async isActiveModule(user: StudentPrincipal): Promise<boolean> {
    const count = await this.academicModuleModel.count({
      where: { id: user.moduleId, status: 'active' },
    });
    return count > 0;
  }

  private extractBearerToken(request: Request): string | undefined {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    return scheme === 'Bearer' ? token : undefined;
  }
}
