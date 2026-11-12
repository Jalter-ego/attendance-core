import { UserRole } from '../../users/repo/user.model';

// Contenido del JWT. `sub` es users.id o students.id según `type`
export interface AdminPrincipal {
  type: 'admin';
  sub: string;
  role: UserRole;
}

export interface StudentPrincipal {
  type: 'student';
  sub: string;
  moduleId: string;
}

export type AuthPrincipal = AdminPrincipal | StudentPrincipal;

export type PrincipalType = AuthPrincipal['type'];
