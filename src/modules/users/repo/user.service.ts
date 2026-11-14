import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { hash } from 'bcryptjs';
import { ForeignKeyConstraintError, UniqueConstraintError } from 'sequelize';
import { PlanLimitsService } from '../../../plan/plan-limits.service';
import { AdminPrincipal } from '../../auth/types/auth-principal';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from './user.model';

const USER_ATTRIBUTES = [
  'id',
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
    private readonly planLimits: PlanLimitsService,
  ) {}

  // RF-05: los usuarios activos de la institución cuentan contra el límite de docentes del plan
  private async assertTeacherSlot() {
    if (this.planLimits.limitOf('teachers') === null) return;
    const active = await this.userModel.count({ where: { isActive: true } });
    this.planLimits.assertWithinLimit('teachers', active + 1);
  }

  async create(dto: CreateUserDto) {
    const role = dto.role ?? 'admin';

    if (dto.isActive ?? true) await this.assertTeacherSlot();

    const passwordHash = await hash(dto.password, 10);

    try {
      const user = await this.userModel.create({
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash,
        role,
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

  async findAll() {
    const users = await this.userModel.findAll({
      attributes: USER_ATTRIBUTES,
      order: [['createdAt', 'DESC']],
    });

    return users;
  }

  async findOne(id: string) {
    const user = await this.findUserEntity(id);
    return this.sanitize(user);
  }

  async update(id: string, dto: UpdateUserDto, currentAdmin?: AdminPrincipal) {
    const user = await this.findUserEntity(id);

    // Reactivar un usuario ocupa un cupo igual que crearlo
    if (dto.isActive === true && !user.isActive) await this.assertTeacherSlot();

    const payload: Partial<User> = {};
    if (dto.name !== undefined) payload.name = dto.name;
    if (dto.email !== undefined) payload.email = dto.email.toLowerCase();
    if (dto.isActive !== undefined) payload.isActive = dto.isActive;
    if (dto.password) {
      payload.passwordHash = await hash(dto.password, 10);
    }

    if (dto.role !== undefined) payload.role = dto.role;
    if (currentAdmin?.sub === user.id && (dto.isActive === false || dto.role === 'admin')) {
      throw new BadRequestException('No puedes desactivar tu cuenta ni quitarte el rol owner');
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
    const user = await this.findUserEntity(id);

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

  private async findUserEntity(id: string): Promise<User> {
    const user = await this.userModel.findByPk(id);
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
