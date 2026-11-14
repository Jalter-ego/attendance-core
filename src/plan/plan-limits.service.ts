import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type PlanResource = 'students' | 'teachers' | 'courses';

export type PlanLimits = Record<PlanResource, number | null>;

const LIMIT_ENV: Record<PlanResource, string> = {
  students: 'PLAN_MAX_STUDENTS',
  teachers: 'PLAN_MAX_TEACHERS',
  courses: 'PLAN_MAX_COURSES',
};

const RESOURCE_LABEL: Record<PlanResource, string> = {
  students: 'estudiantes',
  teachers: 'docentes',
  courses: 'cursos',
};

const PLAN_LABEL: Record<string, string> = {
  basic: 'Básico',
  standard: 'Estándar',
  advanced: 'Avanzado',
};

export function parseLimit(name: string, raw: string | undefined): number | null {
  const value = raw?.trim();
  if (!value) return null;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${name} debe ser un entero positivo (recibido: "${value}")`);
  }
  const limit = Number(value);
  if (!Number.isSafeInteger(limit)) throw new Error(`${name} es demasiado grande`);
  return limit;
}

@Injectable()
export class PlanLimitsService {
  readonly plan: string | null;
  readonly limits: PlanLimits;

  constructor(config: ConfigService) {
    this.limits = {
      students: parseLimit(LIMIT_ENV.students, config.get<string>(LIMIT_ENV.students)),
      teachers: parseLimit(LIMIT_ENV.teachers, config.get<string>(LIMIT_ENV.teachers)),
      courses: parseLimit(LIMIT_ENV.courses, config.get<string>(LIMIT_ENV.courses)),
    };
    this.plan = config.get<string>('TENANT_PLAN')?.trim() || null;
  }

  get planLabel(): string | null {
    if (!this.plan) return null;
    return PLAN_LABEL[this.plan] ?? this.plan;
  }

  limitOf(resource: PlanResource): number | null {
    return this.limits[resource];
  }


  assertWithinLimit(resource: PlanResource, projected: number): void {
    const limit = this.limits[resource];
    if (limit === null || projected <= limit) return;
    const plan = this.planLabel ? `Tu plan ${this.planLabel}` : 'Tu plan';
    throw new ForbiddenException(
      `${plan} permite hasta ${limit} ${RESOURCE_LABEL[resource]} (esta acción llegaría a ${projected}). ` +
        'Para ampliar el límite, solicita un cambio de plan.',
    );
  }
}
