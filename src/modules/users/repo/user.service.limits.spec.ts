import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { PlanLimitsService } from '../../../plan/plan-limits.service';
import { UsersService } from './user.service';

const limits = (env: Record<string, string> = {}) =>
  new PlanLimitsService({ get: (key: string) => env[key] } as unknown as ConfigService);

function setup(env: Record<string, string>, activeUsers: number, existing?: { isActive: boolean }) {
  const created = { get: () => ({ id: 'u1', name: 'Ana', passwordHash: 'x' }) };
  const user = {
    id: 'u2',
    isActive: true,
    ...existing,
    update: vi.fn().mockResolvedValue(undefined),
    get: () => ({ id: 'u2' }),
  };
  const model = {
    count: vi.fn().mockResolvedValue(activeUsers),
    create: vi.fn().mockResolvedValue(created),
    findByPk: vi.fn().mockResolvedValue(user),
  };
  return { model, user, service: new UsersService(model as never, limits(env)) };
}

const dto = { name: 'Ana', email: 'Ana@Example.com', password: 'secreto1' };

describe('UsersService · límite de docentes del plan', () => {
  it('crea el usuario mientras haya cupo', async () => {
    const { model, service } = setup({ PLAN_MAX_TEACHERS: '10', TENANT_PLAN: 'basic' }, 9);
    await service.create(dto);
    expect(model.count).toHaveBeenCalledWith({ where: { isActive: true } });
    expect(model.create).toHaveBeenCalled();
  });

  it('rechaza con 403 al pasar el límite y no crea nada', async () => {
    const { model, service } = setup({ PLAN_MAX_TEACHERS: '10', TENANT_PLAN: 'basic' }, 10);
    await expect(service.create(dto)).rejects.toThrow(ForbiddenException);
    await expect(service.create(dto)).rejects.toThrow(/Tu plan Básico permite hasta 10 docentes/);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('un usuario inactivo no ocupa cupo', async () => {
    const { model, service } = setup({ PLAN_MAX_TEACHERS: '10' }, 10);
    await service.create({ ...dto, isActive: false });
    expect(model.count).not.toHaveBeenCalled();
    expect(model.create).toHaveBeenCalled();
  });

  it('sin límite no consulta la base', async () => {
    const { model, service } = setup({}, 9999);
    await service.create(dto);
    expect(model.count).not.toHaveBeenCalled();
  });

  it('reactivar un usuario sin cupo se rechaza', async () => {
    const { user, service } = setup({ PLAN_MAX_TEACHERS: '10' }, 10, { isActive: false });
    await expect(service.update('u2', { isActive: true })).rejects.toThrow(ForbiddenException);
    expect(user.update).not.toHaveBeenCalled();
  });

  it('reactivar con cupo funciona', async () => {
    const { user, service } = setup({ PLAN_MAX_TEACHERS: '10' }, 9, { isActive: false });
    await service.update('u2', { isActive: true });
    expect(user.update).toHaveBeenCalledWith({ isActive: true });
  });

  it('editar un usuario ya activo no cuenta contra el límite', async () => {
    const { model, user, service } = setup({ PLAN_MAX_TEACHERS: '10' }, 10, { isActive: true });
    await service.update('u2', { name: 'Otro nombre', isActive: true });
    expect(model.count).not.toHaveBeenCalled();
    expect(user.update).toHaveBeenCalled();
  });
});
