import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { parseLimit, PlanLimitsService } from './plan-limits.service';

const service = (env: Record<string, string> = {}) =>
  new PlanLimitsService({ get: (key: string) => env[key] } as unknown as ConfigService);

describe('parseLimit', () => {
  it('trata ausente o vacío como sin límite', () => {
    expect(parseLimit('X', undefined)).toBeNull();
    expect(parseLimit('X', '')).toBeNull();
    expect(parseLimit('X', '   ')).toBeNull();
  });

  it('acepta enteros positivos', () => {
    expect(parseLimit('X', '100')).toBe(100);
    expect(parseLimit('X', ' 5000 ')).toBe(5000);
  });

  it.each(['0', '-5', '1.5', 'abc', '10a', '1e3', '007'])('rechaza %s y nombra la variable', (value) => {
    expect(() => parseLimit('PLAN_MAX_STUDENTS', value)).toThrow(/PLAN_MAX_STUDENTS debe ser un entero positivo/);
  });

  it('rechaza números fuera del rango seguro', () => {
    expect(() => parseLimit('X', '99999999999999999999')).toThrow(/demasiado grande/);
  });
});

describe('PlanLimitsService', () => {
  it('sin variables no limita nada', () => {
    const plan = service();
    expect(plan.limits).toEqual({ students: null, teachers: null, courses: null });
    expect(plan.plan).toBeNull();
    expect(plan.planLabel).toBeNull();
    expect(() => plan.assertWithinLimit('students', 1_000_000)).not.toThrow();
  });

  it('lee los tres límites y el plan', () => {
    const plan = service({
      PLAN_MAX_STUDENTS: '100',
      PLAN_MAX_TEACHERS: '10',
      PLAN_MAX_COURSES: '20',
      TENANT_PLAN: 'basic',
    });
    expect(plan.limits).toEqual({ students: 100, teachers: 10, courses: 20 });
    expect(plan.limitOf('teachers')).toBe(10);
    expect(plan.planLabel).toBe('Básico');
  });

  it('muestra el código si el plan no está en el catálogo', () => {
    expect(service({ TENANT_PLAN: 'custom-x' }).planLabel).toBe('custom-x');
  });

  it('falla al arrancar con un límite inválido', () => {
    expect(() => service({ PLAN_MAX_COURSES: 'muchos' })).toThrow(/PLAN_MAX_COURSES/);
  });

  describe('assertWithinLimit', () => {
    const plan = service({ PLAN_MAX_STUDENTS: '100', TENANT_PLAN: 'basic' });

    it('permite llegar exactamente al límite', () => {
      expect(() => plan.assertWithinLimit('students', 100)).not.toThrow();
    });

    it('lanza 403 con mensaje legible al excederlo', () => {
      expect.assertions(3);
      try {
        plan.assertWithinLimit('students', 101);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).getStatus()).toBe(403);
        expect((error as ForbiddenException).message).toBe(
          'Tu plan Básico permite hasta 100 estudiantes (esta acción llegaría a 101). ' +
            'Para ampliar el límite, solicita un cambio de plan.',
        );
      }
    });

    it('solo limita el recurso configurado', () => {
      expect(() => plan.assertWithinLimit('teachers', 999)).not.toThrow();
    });

    it('sin plan el mensaje no nombra ninguno', () => {
      const anonymous = service({ PLAN_MAX_COURSES: '2' });
      expect(() => anonymous.assertWithinLimit('courses', 3)).toThrow(/^Tu plan permite hasta 2 cursos/);
    });
  });
});
