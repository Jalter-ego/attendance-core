import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  InternalServerErrorException,
  NotFoundException,
  ParseIntPipe,
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
  async slow(@Query('ms', new DefaultValuePipe(DEFAULT_SLOW_MS), ParseIntPipe) ms: number) {
    this.assertEnabled();
    if (ms < 0 || ms > MAX_SLOW_MS) {
      throw new BadRequestException(`ms debe estar entre 0 y ${MAX_SLOW_MS}`);
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
    return { waitedMs: ms };
  }

  private assertEnabled(): void {
    if (!demoEndpointsEnabled(this.config)) throw new NotFoundException();
  }
}
