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
import { ALLOWED_TYPES_KEY, IS_PUBLIC_KEY } from '../auth.decorators';
import { AuthPrincipal, PrincipalType, StudentPrincipal } from '../types/auth-principal';

// Guard global: toda ruta exige JWT salvo las marcadas con @Public()
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    @InjectModel(AcademicModule) private readonly academicModuleModel: typeof AcademicModule,
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

    // El token del estudiante deja de servir cuando se activa otro módulo (RF-13)
    if (request.user.type === 'student' && !(await this.isActiveModule(request.user))) {
      throw new UnauthorizedException('El módulo de esta sesión ya no está activo. Inicia sesión de nuevo');
    }

    const allowed = this.reflector.getAllAndOverride<PrincipalType[]>(ALLOWED_TYPES_KEY, targets);
    if (allowed && !allowed.includes(request.user.type)) {
      throw new ForbiddenException('No tienes permiso para realizar esta acción');
    }

    return true;
  }

  private async isActiveModule(user: StudentPrincipal): Promise<boolean> {
    const count = await this.academicModuleModel.count({
      where: { id: user.moduleId, tenantId: user.tenantId, status: 'active' },
    });
    return count > 0;
  }

  private extractBearerToken(request: Request): string | undefined {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    return scheme === 'Bearer' ? token : undefined;
  }
}
