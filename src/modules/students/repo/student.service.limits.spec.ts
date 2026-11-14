import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { PlanLimitsService } from '../../../plan/plan-limits.service';
import { StudentsService } from './student.service';

// El Excel real no interesa aquí: se simula la lectura y el análisis para controlar cuántas filas llegan.
const excel = vi.hoisted(() => ({ rows: 0 }));
vi.mock('../../../common/excel/excel-reader', () => ({
  readExcelSheet: vi.fn().mockResolvedValue({ rows: [], errors: [] }),
}));
vi.mock('./student-import.parser', () => ({
  STUDENT_COLUMNS: [],
  parseStudentRows: () => ({
    errors: [],
    students: Array.from({ length: excel.rows }, (_, i) => ({
      registrationNumber: `R${i}`,
      fullName: `Estudiante ${i}`,
      email: `e${i}@example.com`,
    })),
  }),
}));

const limits = (env: Record<string, string> = {}) =>
  new PlanLimitsService({ get: (key: string) => env[key] } as unknown as ConfigService);

function setup(env: Record<string, string>, fileRows: number, studentsInOtherModules: number) {
  excel.rows = fileRows;
  const studentModel = { destroy: vi.fn().mockResolvedValue(0), bulkCreate: vi.fn().mockResolvedValue([]) };
  const sequelize = { transaction: vi.fn(async (work: (t: object) => unknown) => work({})) };
  const academicModules = {
    findDraftOrFail: vi.fn().mockResolvedValue({ id: 'm1' }),
    countStudentsInOtherModules: vi.fn().mockResolvedValue(studentsInOtherModules),
  };
  const activityLogs = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new StudentsService(
    studentModel as never,
    sequelize as never,
    academicModules as never,
    activityLogs as never,
    limits(env),
  );
  return { service, studentModel, academicModules };
}

const admin = { type: 'admin', sub: 'a1', role: 'owner' } as never;
const file = { originalname: 'estudiantes.xlsx', buffer: Buffer.alloc(0) } as never;

describe('StudentsService.importForModule · límite de estudiantes del plan', () => {
  it('importa si los demás módulos + el archivo caben en el plan', async () => {
    const { service, studentModel } = setup({ PLAN_MAX_STUDENTS: '100' }, 60, 40);
    await expect(service.importForModule(admin, 'm1', file, '127.0.0.1')).resolves.toEqual({ imported: 60 });
    expect(studentModel.bulkCreate).toHaveBeenCalled();
  });

  it('rechaza con 403 al pasar el límite y no toca los datos del borrador', async () => {
    const { service, studentModel, academicModules } = setup({ PLAN_MAX_STUDENTS: '100', TENANT_PLAN: 'basic' }, 61, 40);
    await expect(service.importForModule(admin, 'm1', file, '127.0.0.1')).rejects.toThrow(ForbiddenException);
    await expect(service.importForModule(admin, 'm1', file, '127.0.0.1')).rejects.toThrow(
      /Tu plan Básico permite hasta 100 estudiantes \(esta acción llegaría a 101\)/,
    );
    expect(academicModules.countStudentsInOtherModules).toHaveBeenCalledWith('m1', {});
    expect(studentModel.destroy).not.toHaveBeenCalled();
    expect(studentModel.bulkCreate).not.toHaveBeenCalled();
  });

  it('sin límite no cuenta los estudiantes de otros módulos', async () => {
    const { service, academicModules } = setup({}, 5000, 5000);
    await expect(service.importForModule(admin, 'm1', file, '127.0.0.1')).resolves.toEqual({ imported: 5000 });
    expect(academicModules.countStudentsInOtherModules).not.toHaveBeenCalled();
  });
});
