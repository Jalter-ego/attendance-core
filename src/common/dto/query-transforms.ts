// Transformaciones para parámetros de query (?search=, ?date=), que siempre llegan como texto

export const trimToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Escapa los comodines de LIKE para buscar el texto tal cual
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);
