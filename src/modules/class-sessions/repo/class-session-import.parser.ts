import { ExcelColumn, ExcelRow, ImportError, SimpleCell } from '../../../common/excel/excel-reader';

type SessionColumn = 'classDate' | 'startTime' | 'endTime';

// Encabezados según el formato de la especificación (sección 5)
export const SESSION_COLUMNS: ExcelColumn<SessionColumn>[] = [
  { key: 'classDate', header: 'Fecha' },
  { key: 'startTime', header: 'Hora inicio' },
  { key: 'endTime', header: 'Hora fin' },
];

const headerOf = (key: SessionColumn) => SESSION_COLUMNS.find((c) => c.key === key)!.header;

export interface ParsedSession {
  classDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

const pad = (n: number) => String(n).padStart(2, '0');

// Acepta texto dd/mm/aaaa o una celda con formato de fecha.
// exceljs entrega las fechas de Excel en UTC, por eso se leen con getUTC*
export function parseClassDate(cell: SimpleCell): string | null {
  let day: number, month: number, year: number;
  if (cell instanceof Date) {
    [day, month, year] = [cell.getUTCDate(), cell.getUTCMonth() + 1, cell.getUTCFullYear()];
  } else if (typeof cell === 'string') {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(cell);
    if (!match) return null;
    [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isRealDate ? `${year}-${pad(month)}-${pad(day)}` : null;
}

// Acepta texto HH:mm o HH:mm:ss, una celda con formato de hora o la fracción de día que guarda Excel
export function parseClassTime(cell: SimpleCell): string | null {
  let hours: number, minutes: number;
  if (cell instanceof Date) {
    [hours, minutes] = [cell.getUTCHours(), cell.getUTCMinutes()];
  } else if (typeof cell === 'number') {
    if (cell < 0 || cell >= 1) return null;
    const total = Math.round(cell * 24 * 60);
    [hours, minutes] = [Math.floor(total / 60), total % 60];
  } else if (typeof cell === 'string') {
    const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(cell);
    if (!match) return null;
    [hours, minutes] = [Number(match[1]), Number(match[2])];
  } else {
    return null;
  }
  return hours < 24 && minutes < 60 ? `${pad(hours)}:${pad(minutes)}` : null;
}

// RF-12: fechas válidas y sin repetir; la hora de fin debe ser posterior a la de inicio
export function parseSessionRows(rows: ExcelRow<SessionColumn>[]) {
  const errors: ImportError[] = [];
  const sessions: ParsedSession[] = [];
  const seenDates = new Map<string, number>();

  for (const { rowNumber, cells } of rows) {
    const error = (key: SessionColumn, message: string) => errors.push({ row: rowNumber, field: headerOf(key), message });

    const classDate = parseClassDate(cells.classDate);
    if (cells.classDate === null) error('classDate', 'Está vacía');
    else if (!classDate) error('classDate', `"${String(cells.classDate)}" no es una fecha válida. Usa dd/mm/aaaa`);
    else if (seenDates.has(classDate)) error('classDate', `La fecha está repetida (fila ${seenDates.get(classDate)})`);
    else seenDates.set(classDate, rowNumber);

    const startTime = parseClassTime(cells.startTime);
    if (cells.startTime === null) error('startTime', 'Está vacía');
    else if (!startTime) error('startTime', `"${String(cells.startTime)}" no es una hora válida. Usa HH:mm`);

    const endTime = parseClassTime(cells.endTime);
    if (cells.endTime === null) error('endTime', 'Está vacía');
    else if (!endTime) error('endTime', `"${String(cells.endTime)}" no es una hora válida. Usa HH:mm`);
    else if (startTime && endTime <= startTime) error('endTime', 'Debe ser posterior a la hora de inicio');

    if (classDate && startTime && endTime) {
      sessions.push({ classDate, startTime, endTime });
    }
  }

  return { sessions, errors };
}
