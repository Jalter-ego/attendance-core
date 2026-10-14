import { IsIn, IsUUID } from 'class-validator';
import type { AttendanceStatus } from '../repo/attendance.model';

// RF-07: el admin fija Presente o Falta en cualquier fecha del módulo activo
export class UpdateAttendanceDto {
  @IsUUID('all', { message: 'studentId debe ser un id válido' })
  studentId: string;

  @IsUUID('all', { message: 'classSessionId debe ser un id válido' })
  classSessionId: string;

  @IsIn(['present', 'absent'], { message: 'status debe ser "present" o "absent"' })
  status: AttendanceStatus;
}
