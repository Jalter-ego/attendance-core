import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { Op } from 'sequelize';
import { PlanLimitsService } from '../../../plan/plan-limits.service';
import { AcademicModulesService } from './academic-module.service';

const limits = (env: Record<string, string> = {}) =>
  new PlanLimitsService({ get: (key: string) => env[key] } as unknown as ConfigService);

function setup(env: Record<string, string>, visibleModules: number) {
  const moduleModel = {
    count: vi.fn().mockResolvedValue(visibleModules),
    create: vi.fn().mockImplementation(async (values: { name: string }) => ({
      id: 'm1',
      name: values.name,
      status: 'draft',
      activatedAt: null,
      archivedAt: null,
    })),
  };
  const studentModel = { count: vi.fn().mockResolvedValue(7) };
  const service = new AcademicModulesService(
    moduleModel as never,
    studentModel as never,
    {} as never,
    {} as never,
    {} as never,
    limits(env),
  );
  return { moduleModel, studentModel, service };
}

describe('AcademicModulesService · límite de cursos del plan', () => {
  it('crea el módulo mientras haya cupo', async () => {
    const { moduleModel, service } = setup({ PLAN_MAX_COURSES: '20' }, 19);
    await service.create('Matemática');
    expect(moduleModel.create).toHaveBeenCalledWith({ name: 'Matemática', status: 'draft' });
  });

  it('cuenta solo módulos en borrador o activos', async () => {
    const { moduleModel, service } = setup({ PLAN_MAX_COURSES: '20' }, 0);
    await service.create('Física');
    expect(moduleModel.count).toHaveBeenCalledWith({ where: { status: { [Op.in]: ['draft', 'active'] } } });
  });

  it('rechaza con 403 al pasar el límite y no crea nada', async () => {
    const { moduleModel, service } = setup({ PLAN_MAX_COURSES: '20', TENANT_PLAN: 'basic' }, 20);
    await expect(service.create('Química')).rejects.toThrow(ForbiddenException);
    await expect(service.create('Química')).rejects.toThrow(/Tu plan Básico permite hasta 20 cursos/);
    expect(moduleModel.create).not.toHaveBeenCalled();
  });

  it('sin límite no consulta la base', async () => {
    const { moduleModel, service } = setup({}, 9999);
    await service.create('Historia');
    expect(moduleModel.count).not.toHaveBeenCalled();
  });

  it('countStudentsInOtherModules excluye el módulo indicado y los archivados', async () => {
    const { studentModel, service } = setup({}, 0);
    await expect(service.countStudentsInOtherModules('m9')).resolves.toBe(7);
    const options = studentModel.count.mock.calls[0][0];
    expect(options.include[0].required).toBe(true);
    expect(options.include[0].where).toEqual({
      id: { [Op.ne]: 'm9' },
      status: { [Op.in]: ['draft', 'active'] },
    });
  });
});
