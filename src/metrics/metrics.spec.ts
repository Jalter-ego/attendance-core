import { Controller, Get, INestApplication, Module, Param } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MetricsModule } from './metrics.module';

@Controller('items')
class ItemsController {
  @Get('boom')
  boom(): never {
    throw new Error('fallo de prueba');
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return { id };
  }
}

@Module({ imports: [MetricsModule], controllers: [ItemsController] })
class TestAppModule {}

describe('Métricas Prometheus', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const scrape = async () => (await http().get('/core/api/v1/metrics').expect(200)).text;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('core/api/v1');
    await app.init();
  });

  afterEach(() => app.close());

  it('cuenta las peticiones con la ruta del patrón, no la URL real', async () => {
    await http().get('/core/api/v1/items/123').expect(200);
    await http().get('/core/api/v1/items/456').expect(200);

    const text = await scrape();
    expect(text).toContain('http_requests_total{method="GET",route="/core/api/v1/items/:id",status="200"} 2');
    expect(text).not.toContain('items/123');
  });

  it('registra los 5xx y la latencia por ruta', async () => {
    await http().get('/core/api/v1/items/boom').expect(500);

    const text = await scrape();
    expect(text).toContain('http_requests_total{method="GET",route="/core/api/v1/items/boom",status="500"} 1');
    expect(text).toMatch(/http_request_duration_seconds_bucket\{[^}]*route="\/core\/api\/v1\/items\/boom"[^}]*status="500"/);
    expect(text).toMatch(/http_request_duration_seconds_count\{[^}]*route="\/core\/api\/v1\/items\/boom"[^}]*\} 1/);
  });

  it('agrupa las rutas inexistentes en una sola etiqueta', async () => {
    await http().get('/core/api/v1/no-existe-1').expect(404);
    await http().get('/core/api/v1/no-existe-2').expect(404);

    const text = await scrape();
    expect(text).toContain('http_requests_total{method="GET",route="unmatched",status="404"} 2');
    expect(text).not.toContain('no-existe');
  });

  it('expone event loop, heap, CPU y memoria', async () => {
    const text = await scrape();
    expect(text).toContain('nodejs_eventloop_lag_seconds');
    expect(text).toContain('nodejs_heap_size_used_bytes');
    expect(text).toContain('process_cpu_seconds_total');
    expect(text).toContain('process_resident_memory_bytes');
  });

  it('responde en el formato de texto de Prometheus', async () => {
    const response = await http().get('/core/api/v1/metrics').expect(200);
    expect(response.headers['content-type']).toMatch(/^text\/plain/);
  });

  it('no se cuenta a sí mismo', async () => {
    await scrape();
    expect(await scrape()).not.toContain('route="/core/api/v1/metrics"');
  });

  it('se oculta (404) a lo que llega por el proxy de nginx', async () => {
    await http().get('/core/api/v1/metrics').set('X-Forwarded-For', '203.0.113.7').expect(404);
  });
});
