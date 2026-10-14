import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ForeignKeyConstraintError, UniqueConstraintError } from 'sequelize';
import { todayInTimezone } from '../../../common/dates/today';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { UpdateTenantDto } from '../dto/update-tenant.dto';
import { Tenant } from './tenant.model';

const DEFAULT_TIMEZONE = 'America/La_Paz';

@Injectable()
export class TenantsService {
  constructor(@InjectModel(Tenant) private readonly tenantModel: typeof Tenant) {}

  async create(dto: CreateTenantDto): Promise<Tenant> {
    try {
      return await this.tenantModel.create({
        name: dto.name,
        slug: dto.slug.toLowerCase(),
        timezone: dto.timezone ?? DEFAULT_TIMEZONE,
        status: dto.status ?? 'active',
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException('Ya existe un tenant con este slug');
      }
      throw error;
    }
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantModel.findAll({
      order: [['createdAt', 'DESC']],
    });
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantModel.findByPk(id);
    if (!tenant) {
      throw new NotFoundException('El tenant no existe');
    }
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findOne(id);
    try {
      const payload: Partial<Tenant> = {};
      if (dto.name !== undefined) payload.name = dto.name;
      if (dto.slug !== undefined) payload.slug = dto.slug.toLowerCase();
      if (dto.timezone !== undefined) payload.timezone = dto.timezone;
      if (dto.status !== undefined) payload.status = dto.status;

      await tenant.update(payload);
      return tenant;
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException('Ya existe un tenant con este slug');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<{ message: string; id: string }> {
    const tenant = await this.findOne(id);
    try {
      await tenant.destroy();
      return { message: 'Tenant eliminado correctamente', id };
    } catch (error) {
      if (
        error instanceof ForeignKeyConstraintError ||
        (error as { name?: string }).name === 'SequelizeForeignKeyConstraintError'
      ) {
        throw new ConflictException('No se puede eliminar el tenant porque tiene datos asociados');
      }
      throw error;
    }
  }

  async timezoneOf(tenantId: string): Promise<string> {
    const tenant = await this.tenantModel.findByPk(tenantId, { attributes: ['timezone'] });
    return tenant?.timezone ?? DEFAULT_TIMEZONE;
  }

  // Fecha de hoy 'YYYY-MM-DD' en la zona horaria del tenant (RN-04)
  async todayFor(tenantId: string): Promise<string> {
    return todayInTimezone(await this.timezoneOf(tenantId));
  }
}
