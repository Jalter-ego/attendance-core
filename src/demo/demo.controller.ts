import {
  BadRequestException,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../modules/auth/auth.decorators';

export const MAX_SLOW_MS = 10_000;
const DEFAULT_SLOW_MS = 2_000;

/**
 * Los endpoints de demo solo existen fuera de producción. Falla cerrado: un tenant (NODE_ENV=production
 * en su backend.env) los deja activos únicamente si TENANT_ENV es explícitamente `test`.
 * Sin TENANT_ENV (desarrollo local) se activan mientras NODE_ENV no sea production.
 */
export function demoEndpointsEnabled(config: ConfigService): boolean {
  const tenantEnv = config.get<string>('TENANT_ENV')?.trim();
  if (tenantEnv) return tenantEnv === 'test';
  return config.get<string>('NODE_ENV') !== 'production';
}

// Sirven para provocar a propósito 500 y latencia alta y demostrar el panel y la alerta de Grafana
@Controller('demo')
export class DemoController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get('error')
  error(): never {
    this.assertEnabled();
    throw new InternalServerErrorException('Error de demostración provocado a propósito');
  }

  @Public()
  @Get('slow')
  // Se lee el valor crudo y se valida a mano: con el ValidationPipe global (transform: true) un
  // "abc" llegaría a un pipe de Nest ya convertido en NaN y se confundiría con "no enviado".
  async slow(@Query('ms') raw: unknown) {
    this.assertEnabled();
    const ms = raw === undefined ? DEFAULT_SLOW_MS : typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(ms) || ms > MAX_SLOW_MS) {
      throw new BadRequestException(`ms debe ser un entero entre 0 y ${MAX_SLOW_MS}`);
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
    return { waitedMs: ms };
  }

  private assertEnabled(): void {
    if (!demoEndpointsEnabled(this.config)) throw new NotFoundException();
  }
}
