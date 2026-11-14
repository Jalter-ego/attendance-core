import { ConfigService } from '@nestjs/config';
import { PlanLimitsService } from './plan-limits.service';
import { PlanUsageService } from './plan-usage.service';

const limits = (env: Record<string, string>) =>
  new PlanLimitsService({ get: (key: string) => env[key] } as unknown as ConfigService);

const counting = (n: number) => ({ count: vi.fn().mockResolvedValue(n) });

describe('PlanUsageService', () => {
  it('informa uso, límite y restante por recurso', async () => {
    const service = new PlanUsageService(
      counting(3) as never,
      counting(2) as never,
      counting(85) as never,
      limits({ PLAN_MAX_STUDENTS: '100', PLAN_MAX_TEACHERS: '10', PLAN_MAX_COURSES: '20', TENANT_PLAN: 'basic' }),
    );

    expect(await service.summary()).toEqual({
      plan: { code: 'basic', name: 'Básico' },
      usage: {
        students: { used: 85, limit: 100, remaining: 15 },
        teachers: { used: 3, limit: 10, remaining: 7 },
        courses: { used: 2, limit: 20, remaining: 18 },
      },
    });
  });

  it('sin plan ni límites devuelve null y nunca un restante negativo', async () => {
    const service = new PlanUsageService(
      counting(12) as never,
      counting(0) as never,
      counting(0) as never,
      limits({ PLAN_MAX_TEACHERS: '10' }),
    );

    const result = await service.summary();
    expect(result.plan).toEqual({ code: null, name: null });
    expect(result.usage.students).toEqual({ used: 0, limit: null, remaining: null });
    // 12 usuarios con límite 10 (p. ej. se bajó de plan): no hay cupo, pero no es negativo
    expect(result.usage.teachers).toEqual({ used: 12, limit: 10, remaining: 0 });
  });
});
