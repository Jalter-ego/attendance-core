import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { ExcelReadError, ImportError } from './excel-reader';

export const EXCEL_FIELD = 'file';

export const excelUploadOptions: MulterOptions = {
  limits: { fileSize: 5 * 1024 * 1024 },
};

export function assertExcelFile(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
  if (!file) {
    throw new BadRequestException(`Adjunta el archivo Excel en el campo "${EXCEL_FIELD}"`);
  }
  if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
    throw new BadRequestException('El archivo debe ser un Excel .xlsx');
  }
}

// RF-11: responde con todas las filas que hay que corregir
export function throwImportErrors(errors: ImportError[]): never {
  throw new UnprocessableEntityException({
    message: errors.length === 1 ? 'El archivo tiene 1 error' : `El archivo tiene ${errors.length} errores`,
    errors,
  });
}

export function rethrowExcelReadError(error: unknown): never {
  if (error instanceof ExcelReadError) {
    throw new UnprocessableEntityException({ message: error.message, errors: [] });
  }
  throw error;
}
