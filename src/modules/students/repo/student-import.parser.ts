import { isEmail } from 'class-validator';
import { cellToText, ExcelColumn, ExcelRow, ImportError } from '../../../common/excel/excel-reader';

type StudentColumn = 'registrationNumber' | 'fullName' | 'email';

// Encabezados según el formato de la especificación (sección 5)
export const STUDENT_COLUMNS: ExcelColumn<StudentColumn>[] = [
  { key: 'registrationNumber', header: 'Número de registro' },
  { key: 'fullName', header: 'Nombre completo' },
  { key: 'email', header: 'Correo electrónico' },
];

const headerOf = (key: StudentColumn) => STUDENT_COLUMNS.find((c) => c.key === key)!.header;

export interface ParsedStudent {
  registrationNumber: string;
  fullName: string;
  email: string;
}

// RF-11: campos obligatorios, correo válido y duplicados dentro del archivo
export function parseStudentRows(rows: ExcelRow<StudentColumn>[]) {
  const errors: ImportError[] = [];
  const students: ParsedStudent[] = [];
  const seenRegistration = new Map<string, number>();
  const seenEmail = new Map<string, number>();

  for (const { rowNumber, cells } of rows) {
    const error = (key: StudentColumn, message: string) => errors.push({ row: rowNumber, field: headerOf(key), message });

    const registrationNumber = cellToText(cells.registrationNumber);
    const fullName = cellToText(cells.fullName);
    const email = cellToText(cells.email);

    if (!registrationNumber) error('registrationNumber', 'Está vacío');
    else if (registrationNumber.length > 50) error('registrationNumber', 'No puede superar 50 caracteres');
    else if (seenRegistration.has(registrationNumber)) {
      error('registrationNumber', `${registrationNumber} está repetido (fila ${seenRegistration.get(registrationNumber)})`);
    } else seenRegistration.set(registrationNumber, rowNumber);

    if (!fullName) error('fullName', 'Está vacío');
    else if (fullName.length > 200) error('fullName', 'No puede superar 200 caracteres');

    const emailKey = email?.toLowerCase();
    if (!email || !emailKey) error('email', 'Está vacío');
    else if (!isEmail(email) || email.length > 255) error('email', `"${email}" no es un correo válido`);
    else if (seenEmail.has(emailKey)) error('email', `${email} está repetido (fila ${seenEmail.get(emailKey)})`);
    else seenEmail.set(emailKey, rowNumber);

    if (registrationNumber && fullName && email) {
      students.push({ registrationNumber, fullName, email });
    }
  }

  return { students, errors };
}
