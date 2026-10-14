import { Workbook } from 'exceljs';

export const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Deja un texto apto para un nombre de archivo: sin tildes, en minúsculas y con
 * guiones. Así `Módulo 3 - Backend` queda `modulo-3-backend`.
 */
export function toFileSlug(value: string, fallback = 'archivo'): string {
  const slug = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return slug || fallback;
}

/**
 * Valor del header `Content-Disposition` para una descarga.
 *
 * Va el nombre en ASCII y además `filename*` en UTF-8, que es el que usan los
 * navegadores actuales. Las comillas y los caracteres de control se quitan para
 * no poder romper el header.
 */
export function attachmentDisposition(filename: string): string {
  const safe = filename.replace(/["\\\r\n]/g, '');
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function workbookToBuffer(workbook: Workbook): Promise<Buffer> {
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
