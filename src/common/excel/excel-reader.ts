import { Workbook, type CellValue } from 'exceljs';

// Error de una celda o fila, con el número de fila tal como se ve en Excel
export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ExcelColumn<K extends string> {
  key: K;
  header: string;
}

// Valor de celda ya simplificado: texto, número, fecha o vacío
export type SimpleCell = string | number | Date | null;

export interface ExcelRow<K extends string> {
  rowNumber: number;
  cells: Record<K, SimpleCell>;
}

export class ExcelReadError extends Error {}

const MAX_ROWS = 5000;

// "Número de registro" → "numero de registro"
export const normalizeHeader = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// exceljs entrega fórmulas, hipervínculos (los correos suelen serlo) y texto enriquecido como objetos
function simplifyCell(value: CellValue): SimpleCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value === 'number') return value;
  if (typeof value === 'string') return value.trim() === '' ? null : value.trim();
  if (typeof value === 'boolean') return String(value);
  if ('result' in value) return simplifyCell(value.result as CellValue);
  if ('richText' in value) return simplifyCell(value.richText.map((part) => part.text).join(''));
  if ('text' in value) return simplifyCell(value.text as CellValue);
  return null;
}

// Lee la primera hoja. La fila 1 son los encabezados; las filas vacías se ignoran
export async function readExcelSheet<K extends string>(
  buffer: Buffer,
  columns: ExcelColumn<K>[],
): Promise<{ rows: ExcelRow<K>[]; errors: ImportError[] }> {
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ExcelReadError('No se pudo leer el archivo. Verifica que sea un Excel .xlsx');
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.actualRowCount === 0) {
    throw new ExcelReadError('El archivo está vacío');
  }

  const headerRow = sheet.getRow(1);
  const positions = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    const text = simplifyCell(cell.value);
    if (typeof text === 'string') positions.set(normalizeHeader(text), colNumber);
  });

  const errors: ImportError[] = columns
    .filter((column) => !positions.has(normalizeHeader(column.header)))
    .map((column) => ({ row: 1, field: column.header, message: 'Falta esta columna en el encabezado' }));
  if (errors.length > 0) return { rows: [], errors };

  if (sheet.actualRowCount - 1 > MAX_ROWS) {
    throw new ExcelReadError(`El archivo supera el máximo de ${MAX_ROWS} filas`);
  }

  const rows: ExcelRow<K>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells = {} as Record<K, SimpleCell>;
    for (const column of columns) {
      cells[column.key] = simplifyCell(row.getCell(positions.get(normalizeHeader(column.header))!).value);
    }
    if (Object.values(cells).some((cell) => cell !== null)) {
      rows.push({ rowNumber, cells });
    }
  });

  return { rows, errors: [] };
}

// Texto de una celda; un número como 1001 se convierte en "1001"
export function cellToText(cell: SimpleCell): string | null {
  if (cell === null || cell instanceof Date) return null;
  return String(cell);
}
