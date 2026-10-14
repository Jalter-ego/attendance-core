/* Resolución de orígenes permitidos para CORS.
 *
 * El frontend resuelve la institución desde el subdominio
 * (`demo.localhost:5173`, `wabi.attlasian.test:5173`), así que un único valor en
 * `CORS_ORIGIN` no alcanza: cada subdominio es un origen distinto para el
 * navegador. Aquí se admite una lista separada por comas, y cada entrada puede
 * llevar `*` en lugar del subdominio.
 *
 * Ejemplos de `CORS_ORIGIN`:
 *   *                                              → cualquier origen
 *   http://localhost:5173,http://*.localhost:5173  → localhost y sus subdominios
 */

const ALLOW_ALL = '*'

/** `*` cubre una sola etiqueta de dominio, con la forma de un slug de tenant */
const WILDCARD_LABEL = '[a-z0-9]+(?:-[a-z0-9]+)*'

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join(WILDCARD_LABEL)
  return new RegExp(`^${escaped}$`, 'i')
}

export function parseCorsOrigins(raw: string | undefined): string[] {
  return (raw ?? ALLOW_ALL)
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

export type CorsOriginCheck = (
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) => void;

/**
 * Construye el verificador que recibe `enableCors`.
 * Un origen ausente (curl, Postman, peticiones del mismo servidor) se permite:
 * CORS solo protege al navegador, que siempre manda `Origin`.
 */
export function buildCorsOriginCheck(raw: string | undefined): CorsOriginCheck {
  const patterns = parseCorsOrigins(raw)

  if (patterns.includes(ALLOW_ALL)) {
    return (_origin, callback) => callback(null, true)
  }

  const matchers = patterns.map(patternToRegExp)

  return (origin, callback) => {
    if (!origin) {
      callback(null, true)
      return
    }
    const normalized = origin.replace(/\/$/, '')
    callback(null, matchers.some((matcher) => matcher.test(normalized)))
  }
}
