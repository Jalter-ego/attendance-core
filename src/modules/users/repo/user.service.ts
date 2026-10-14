import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { hash } from 'bcryptjs';
import { ForeignKeyConstraintError, UniqueConstraintError, WhereOptions } from 'sequelize';
import { AdminPrincipal } from '../../auth/types/auth-principal';
import { Tenant } from '../../tenants/repo/tenant.model';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User, UserRole } from './user.model';

const USER_ATTRIBUTES = [
  'id',
  'tenantId',
  'name',
  'email',
  'role',
  'isActive',
  'lastLoginAt',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(Tenant) private readonly tenantModel: typeof Tenant,
  ) {}

  async create(dto: CreateUserDto, currentAdmin?: AdminPrincipal) {
    const role: UserRole = dto.role ?? 'admin';
    let tenantId: string | null = null;

    if (currentAdmin && currentAdmin.role !== 'superadmin') {
      if (role === 'superadmin') {
        throw new ForbiddenException('No tienes permiso para crear usuarios superadmin');
      }
      if (dto.tenantId && dto.tenantId !== currentAdmin.tenantId) {
        throw new ForbiddenException('No puedes crear usuarios en otro tenant');
      }
      tenantId = currentAdmin.tenantId;
    } else {
      if (role === 'superadmin') {
        tenantId = null;
      } else {
        tenantId = dto.tenantId ?? currentAdmin?.tenantId ?? null;
        if (!tenantId) {
          throw new BadRequestException(
            'Debes indicar un tenantId para usuarios con rol owner o admin',
          );
        }
      }
    }

    if (tenantId) {
      const tenant = await this.tenantModel.findByPk(tenantId);
      if (!tenant) {
        throw new NotFoundException('El tenant especificado no existe');
      }
    }

    const passwordHash = await hash(dto.password, 10);

    try {
      const user = await this.userModel.create({
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash,
        role,
        tenantId,
        isActive: dto.isActive ?? true,
      });

      return this.sanitize(user);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException('Ya existe un usuario con este correo electrónico');
      }
      throw error;
    }
  }

  async findAll(currentAdmin?: AdminPrincipal) {
    const where: WhereOptions<User> = {};
    if (currentAdmin && currentAdmin.role !== 'superadmin') {
      where.tenantId = currentAdmin.tenantId;
    }

    const users = await this.userModel.findAll({
      where,
      attributes: USER_ATTRIBUTES,
      order: [['createdAt', 'DESC']],
    });

    return users;
  }

  async findOne(id: string, currentAdmin?: AdminPrincipal) {
    const user = await this.findUserEntity(id, currentAdmin);
    return this.sanitize(user);
  }

  async update(id: string, dto: UpdateUserDto, currentAdmin?: AdminPrincipal) {
    const user = await this.findUserEntity(id, currentAdmin);

    if (currentAdmin && currentAdmin.role !== 'superadmin') {
      if (dto.role === 'superadmin') {
        throw new ForbiddenException('No tienes permiso para asignar el rol superadmin');
      }
      if (dto.tenantId && dto.tenantId !== currentAdmin.tenantId) {
        throw new ForbiddenException('No puedes mover el usuario a otro tenant');
      }
    }

    const payload: Partial<User> = {};
    if (dto.name !== undefined) payload.name = dto.name;
    if (dto.email !== undefined) payload.email = dto.email.toLowerCase();
    if (dto.isActive !== undefined) payload.isActive = dto.isActive;
    if (dto.password) {
      payload.passwordHash = await hash(dto.password, 10);
    }

    const targetRole = dto.role ?? user.role;
    let targetTenantId = dto.tenantId !== undefined ? dto.tenantId : user.tenantId;

    if (targetRole === 'superadmin') {
      targetTenantId = null;
    } else if (!targetTenantId) {
      throw new BadRequestException(
        'Los usuarios con rol owner o admin deben pertenecer a un tenant',
      );
    }

    if (targetTenantId && targetTenantId !== user.tenantId) {
      const tenant = await this.tenantModel.findByPk(targetTenantId);
      if (!tenant) {
        throw new NotFoundException('El tenant especificado no existe');
      }
    }

    if (dto.role !== undefined) payload.role = targetRole;
    if (dto.tenantId !== undefined || targetRole === 'superadmin') {
      payload.tenantId = targetTenantId;
    }

    try {
      await user.update(payload);
      return this.sanitize(user);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException('Ya existe un usuario con este correo electrónico');
      }
      throw error;
    }
  }

  async remove(id: string, currentAdmin?: AdminPrincipal): Promise<{ message: string; id: string }> {
    const user = await this.findUserEntity(id, currentAdmin);

    if (currentAdmin && currentAdmin.sub === user.id) {
      throw new BadRequestException('No puedes eliminar tu propio usuario');
    }

    try {
      await user.destroy();
      return { message: 'Usuario eliminado correctamente', id };
    } catch (error) {
      if (
        error instanceof ForeignKeyConstraintError ||
        (error as { name?: string }).name === 'SequelizeForeignKeyConstraintError'
      ) {
        throw new ConflictException(
          'No se puede eliminar el usuario porque tiene registros asociados',
        );
      }
      throw error;
    }
  }

  private async findUserEntity(id: string, currentAdmin?: AdminPrincipal): Promise<User> {
    const where: WhereOptions<User> = { id };
    if (currentAdmin && currentAdmin.role !== 'superadmin') {
      where.tenantId = currentAdmin.tenantId;
    }

    const user = await this.userModel.findOne({ where });
    if (!user) {
      throw new NotFoundException('El usuario no existe');
    }
    return user;
  }

  private sanitize(user: User) {
    const raw = user.get({ plain: true }) as Partial<User>;
    delete raw.passwordHash;
    return raw;
  }
}
