// Fecha de hoy 'YYYY-MM-DD' en la zona horaria del tenant (RN-04: "el día de clase" depende de ella)
export function todayInTimezone(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
}
