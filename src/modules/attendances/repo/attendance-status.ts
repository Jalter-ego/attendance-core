import { AttendanceStatus } from './attendance.model';

// Estado que se muestra para una fecha de clase:
// - present / absent: definitivo
// - pending: es hoy y el estudiante todavía puede marcar
// - upcoming: la fecha aún no llega
export type SessionAttendanceStatus = AttendanceStatus | 'pending' | 'upcoming';

// RN-05: al terminar el día, la ausencia de marca equivale a Falta.
// Las fechas son 'YYYY-MM-DD', así que se comparan como texto
export function resolveSessionStatus(
  classDate: string,
  today: string,
  recorded: AttendanceStatus | null,
): SessionAttendanceStatus {
  if (recorded) return recorded;
  if (classDate < today) return 'absent';
  if (classDate === today) return 'pending';
  return 'upcoming';
}

export function countStatuses(rows: { status: SessionAttendanceStatus }[]) {
  const count = (status: SessionAttendanceStatus) => rows.filter((r) => r.status === status).length;
  return {
    total: rows.length,
    present: count('present'),
    absent: count('absent'),
    pending: count('pending'),
    upcoming: count('upcoming'),
  };
}
