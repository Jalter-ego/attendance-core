import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { AuthPrincipal, PrincipalType } from './types/auth-principal';

export const IS_PUBLIC_KEY = 'isPublic';
export const ALLOWED_TYPES_KEY = 'allowedPrincipalTypes';

// Ruta sin autenticación, como el login
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Restringe la ruta a admins o estudiantes: @AllowOnly('admin')
export const AllowOnly = (...types: PrincipalType[]) => SetMetadata(ALLOWED_TYPES_KEY, types);

// Quién hace la petición, tal como viene en el JWT
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal =>
    context.switchToHttp().getRequest<{ user: AuthPrincipal }>().user,
);
