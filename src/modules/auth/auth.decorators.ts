import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { UserRole } from '../users/repo/user.model';
import { AuthPrincipal, PrincipalType } from './types/auth-principal';

export const IS_PUBLIC_KEY = 'isPublic';
export const ALLOWED_TYPES_KEY = 'allowedPrincipalTypes';
export const ALLOWED_ROLES_KEY = 'allowedAdminRoles';

// Ruta sin autenticación, como el login
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Restringe la ruta a admins o estudiantes: @AllowOnly('admin')
export const AllowOnly = (...types: PrincipalType[]) => SetMetadata(ALLOWED_TYPES_KEY, types);

// Restringe además por rol del admin: @AllowRoles('superadmin').
// Para rutas que administran la plataforma, no una institución
export const AllowRoles = (...roles: UserRole[]) => SetMetadata(ALLOWED_ROLES_KEY, roles);

// Quién hace la petición, tal como viene en el JWT
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal =>
    context.switchToHttp().getRequest<{ user: AuthPrincipal }>().user,
);
