import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { todayInTimezone } from '../common/dates/today';

/** Una instalación representa una institución; estos datos no seleccionan una base. */
@Injectable()
export class InstitutionService {
  readonly name: string;
  readonly timezone: string;

  constructor(config: ConfigService) {
    this.name = config.get<string>('INSTITUTION_NAME', 'Institución').trim();
    this.timezone = config.get<string>('INSTITUTION_TIMEZONE', 'America/La_Paz').trim();
    if (!this.name) throw new Error('INSTITUTION_NAME no puede estar vacío');
    // Falla al arrancar si la zona no existe, antes de permitir marcas con fechas incorrectas.
    new Intl.DateTimeFormat('en-CA', { timeZone: this.timezone }).format();
  }

  summary() {
    return { name: this.name, timezone: this.timezone };
  }

  today(): string {
    return todayInTimezone(this.timezone);
  }
}
