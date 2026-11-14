export interface AnalyzeRequest {
  model: string
  apiKey: string
  baseUrl: string
  image: { base64: string; mediaType: 'image/png' | 'image/jpeg' }
  note: string
  /** Dominant colours measured from the image, as hex. */
  palette: string[]
}

export interface ModelQuery {
  apiKey: string
  baseUrl: string
}

/**
 * One model service. `analyze` returns the model's answer as parsed JSON
 * (unvalidated; the caller normalises it) and `listModels` returns model ids,
 * best first.
 */
export interface Provider {
  analyze(request: AnalyzeRequest): Promise<unknown>
  listModels(query: ModelQuery): Promise<string[]>
}

/** An error whose message is written for the person using the app. */
export class ProviderError extends Error {}

const TIMEOUT_MS = 120_000

/**
 * fetch + JSON with a timeout, turning HTTP and network failures into
 * ProviderError with a message that says what to do about it.
 */
export async function requestJson(
  service: string,
  url: string,
  init: RequestInit = {}
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new ProviderError(`${service} took too long to answer.`)
    }
    throw new ProviderError(`Could not reach ${service}. Check the address and your connection.`)
  }

  const body = await response.text()
  if (!response.ok) throw new ProviderError(describeHttpFailure(service, response.status, body))

  try {
    return JSON.parse(body)
  } catch {
    throw new ProviderError(`${service} sent a reply that could not be read.`)
  }
}

export function describeHttpFailure(service: string, status: number, body: string): string {
  if (status === 401 || status === 403) return `${service} rejected the API key.`
  if (status === 404) return `${service} does not know that model or address.`
  if (status === 429) return `${service} is rate-limiting this key. Try again in a moment.`
  if (status >= 500) return `${service} is having trouble (${status}). Try again shortly.`
  const detail = extractErrorMessage(body)
  return detail ? `${service}: ${detail}` : `${service} refused the request (${status}).`
}

function extractErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown } | string }
    const message = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message
    return typeof message === 'string' ? message.slice(0, 200) : ''
  } catch {
    return ''
  }
}

/**
 * Orders model ids so the ones matching earlier patterns come first, newest
 * (highest natural sort) first within a pattern. Unmatched ids keep their
 * place at the end.
 */
export function rankModels(ids: string[], preferred: RegExp[]): string[] {
  const rank = (id: string): number => {
    const index = preferred.findIndex((pattern) => pattern.test(id))
    return index === -1 ? preferred.length : index
  }
  return [...new Set(ids)].sort(
    (a, b) => rank(a) - rank(b) || b.localeCompare(a, undefined, { numeric: true })
  )
}
