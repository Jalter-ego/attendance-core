import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DemoController, demoEndpointsEnabled, MAX_SLOW_MS } from './demo.controller';

const config = (env: Record<string, string>) => ({ get: (key: string) => env[key] }) as unknown as ConfigService;

describe('demoEndpointsEnabled', () => {
  it.each([
    [{ TENANT_ENV: 'test', NODE_ENV: 'production' }, true],
    [{ TENANT_ENV: 'prod', NODE_ENV: 'production' }, false],
    [{ TENANT_ENV: 'prod', NODE_ENV: 'development' }, false],
    [{ NODE_ENV: 'development' }, true],
    [{}, true],
    // Falla cerrado: un backend de tenant (NODE_ENV=production) sin TENANT_ENV no los expone
    [{ NODE_ENV: 'production' }, false],
  ])('%j -> %s', (env, expected) => {
    expect(demoEndpointsEnabled(config(env))).toBe(expected);
  });
});

describe('Endpoints de demo', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  async function start(env: Record<string, string>) {
    const moduleRef = await Test.createTestingModule({
      controllers: [DemoController],
      providers: [{ provide: ConfigService, useValue: config(env) }],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('core/api/v1');
    // Igual que main.ts: con transform un valor no numérico llega convertido a NaN a los pipes
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  }

  afterEach(() => app.close());

  describe('en un tenant de pruebas', () => {
    beforeEach(() => start({ TENANT_ENV: 'test', NODE_ENV: 'production' }));

    it('/demo/error responde 500', async () => {
      await http().get('/core/api/v1/demo/error').expect(500);
    });

    it('/demo/slow espera el tiempo pedido', async () => {
      const started = Date.now();
      const response = await http().get('/core/api/v1/demo/slow?ms=80').expect(200);
      expect(response.body).toEqual({ waitedMs: 80 });
      expect(Date.now() - started).toBeGreaterThanOrEqual(75);
    });

    it.each(['abc', '-1', '1.5', '', String(MAX_SLOW_MS + 1)])('/demo/slow rechaza ms=%j con 400', async (ms) => {
      await http().get(`/core/api/v1/demo/slow?ms=${ms}`).expect(400);
    });
  });

  describe('en producción', () => {
    beforeEach(() => start({ TENANT_ENV: 'prod', NODE_ENV: 'production' }));

    it('no existen (404)', async () => {
      await http().get('/core/api/v1/demo/error').expect(404);
      await http().get('/core/api/v1/demo/slow?ms=10').expect(404);
    });
  });
});
