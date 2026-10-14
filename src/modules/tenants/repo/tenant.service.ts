import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { todayInTimezone } from '../../../common/dates/today';
import { Tenant } from './tenant.model';

const DEFAULT_TIMEZONE = 'America/La_Paz';

@Injectable()
export class TenantsService {
  constructor(@InjectModel(Tenant) private readonly tenantModel: typeof Tenant) {}

  async timezoneOf(tenantId: string): Promise<string> {
    const tenant = await this.tenantModel.findByPk(tenantId, { attributes: ['timezone'] });
    return tenant?.timezone ?? DEFAULT_TIMEZONE;
  }

  // Fecha de hoy 'YYYY-MM-DD' en la zona horaria del tenant (RN-04)
  async todayFor(tenantId: string): Promise<string> {
    return todayInTimezone(await this.timezoneOf(tenantId));
  }
}
