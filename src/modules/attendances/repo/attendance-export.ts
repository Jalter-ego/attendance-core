import { Workbook } from 'exceljs';
import { workbookToBuffer } from '../../../common/excel/excel-writer';
import { ClassSession } from '../../class-sessions/repo/class-session.model';
import { Student } from '../../students/repo/student.model';
import { SessionAttendanceStatus } from './attendance-status';

// Mismas etiquetas que muestra el frontend, para que el Excel se lea igual
const STATUS_LABEL: Record<SessionAttendanceStatus, string> = {
  present: 'Presente',
  absent: 'Falta',
  pending: 'Pendiente',
  upcoming: 'Próxima',
};

const HEADER_FILL = 'FFEDF3EE';
const TOTAL_FILL = 'FFF5F7F5';

export interface ExportCell {
  status: SessionAttendanceStatus;
  markedAt: Date | null;
}

export interface ExportInput {
  moduleName: string;
  /** Fecha de hoy en la zona horaria de la institución */
  today: string;
  filters: { date: string | null; studentName: string | null };
  students: Student[];
  sessions: ClassSession[];
  /** Clave `studentId:classSessionId` */
  cells: Map<string, ExportCell>;
}

/** `2026-10-14` → `14/10/2026`, sin que la zona del servidor corra el día */
function formatDate(classDate: string): string {
  const [year, month, day] = classDate.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * RF-17: una hoja con la matriz estudiante × fecha del módulo activo.
 *
 * Es la misma vista que el admin ve en pantalla (RF-08), con los totales por
 * estudiante y por fecha, para que el archivo se pueda leer sin la aplicación.
 */
export async function buildAttendanceWorkbook(input: ExportInput): Promise<Buffer> {
  const { moduleName, today, filters, students, sessions, cells } = input;

  const workbook = new Workbook();
  workbook.creator = 'Control de Asistencia';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Asistencias', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 6 }],
  });

  // Encabezado del documento
  sheet.getCell('A1').value = 'Control de asistencia';
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A2').value = `Módulo: ${moduleName}`;
  sheet.getCell('A3').value = `Generado el ${formatDate(today)}`;

  const applied = [
    filters.date && `fecha ${formatDate(filters.date)}`,
    filters.studentName && `estudiante ${filters.studentName}`,
  ].filter(Boolean);
  sheet.getCell('A4').value = applied.length > 0 ? `Filtros: ${applied.join(' · ')}` : 'Sin filtros';
  for (const row of ['A2', 'A3', 'A4']) {
    sheet.getCell(row).font = { color: { argb: 'FF78837B' }, size: 10 };
  }

  // Fila 5 vacía; la 6 son los encabezados de la tabla
  const header = [
    'Número de registro',
    'Nombre completo',
    ...sessions.map((session) => formatDate(session.classDate)),
    'Presentes',
    'Faltas',
  ];
  const headerRow = sheet.getRow(6);
  headerRow.values = header;
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFDFE5E0' } } };
  });
  sheet.getCell(6, 1).alignment = { horizontal: 'left' };
  sheet.getCell(6, 2).alignment = { horizontal: 'left' };

  // Una fila por estudiante
  for (const student of students) {
    const statuses = sessions.map(
      (session) => cells.get(`${student.id}:${session.id}`)?.status ?? null,
    );
    const presents = statuses.filter((status) => status === 'present').length;
    const absents = statuses.filter((status) => status === 'absent').length;

    const row = sheet.addRow([
      student.registrationNumber,
      student.fullName,
      ...statuses.map((status) => (status ? STATUS_LABEL[status] : '—')),
      presents,
      absents,
    ]);
    row.eachCell((cell, column) => {
      if (column > 2) cell.alignment = { horizontal: 'center' };
    });
  }

  // Totales por fecha: presentes sobre el total de estudiantes.
  // Las fechas que aún no llegan quedan en blanco: no hay nada que contar
  const totals = sheet.addRow([
    'Presentes',
    '',
    ...sessions.map((session) => {
      if (session.classDate > today) return '—';
      const present = students.filter(
        (student) => cells.get(`${student.id}:${session.id}`)?.status === 'present',
      ).length;
      return `${present}/${students.length}`;
    }),
    '',
    '',
  ]);
  totals.font = { bold: true };
  totals.eachCell((cell, column) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };
    if (column > 2) cell.alignment = { horizontal: 'center' };
  });

  sheet.getColumn(1).width = 20;
  sheet.getColumn(2).width = 32;
  for (let column = 3; column <= sessions.length + 4; column += 1) {
    sheet.getColumn(column).width = 12;
  }

  return workbookToBuffer(workbook);
}
