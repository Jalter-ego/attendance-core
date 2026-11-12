/* Lista de orígenes del frontend. Se admiten dominios exactos y comodines explícitos. */

const ALLOW_ALL = '*'

/** `*` cubre una sola etiqueta de dominio, sin incluir puntos */
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
