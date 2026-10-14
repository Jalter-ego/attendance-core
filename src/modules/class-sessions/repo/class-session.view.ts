import { ClassSession } from './class-session.model';

// Forma pública de una fecha de clase; Postgres devuelve TIME como 'HH:mm:ss'
export function toSessionView(session: ClassSession) {
  return {
    id: session.id,
    classDate: session.classDate,
    startTime: session.startTime.slice(0, 5),
    endTime: session.endTime.slice(0, 5),
  };
}
