import { API_URL } from './config'

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public requestId: string) {
    super(message)
  }
  /** Testo per l'utente, con l'id della richiesta per ritrovarla nei log. */
  get display(): string {
    if (this.status === 503) return 'Servizio temporaneamente non disponibile: riprova tra poco.'
    return this.requestId ? `${this.message} (rif. ${this.requestId})` : this.message
  }
}

type TokenSource = () => string | null
let tokenSource: TokenSource = () => null
let onUnauthorized: () => void = () => {}

export function configureApi(t: TokenSource, unauthorized: () => void) {
  tokenSource = t
  onUnauthorized = unauthorized
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = tokenSource()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'omit',
    })
  } catch {
    throw new ApiError(0, 'network', 'Server non raggiungibile: controlla la connessione.', '')
  }
  const rid = res.headers.get('X-Request-Id') ?? ''
  if (res.status === 204) return undefined as T
  let data: unknown = null
  try { data = await res.json() } catch { /* corpo non JSON */ }
  if (!res.ok) {
    if (res.status === 401) onUnauthorized()
    const e = (data as { error?: { code?: string; message?: string; request_id?: string } } | null)?.error
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? 'Errore imprevisto', e?.request_id ?? rid)
  }
  return data as T
}

export const get = <T>(p: string) => api<T>(p)
export const post = <T>(p: string, body?: unknown) => api<T>(p, { method: 'POST', body: body ?? {} })
export const put = <T>(p: string, body: unknown) => api<T>(p, { method: 'PUT', body })
export const patch = <T>(p: string, body: unknown) => api<T>(p, { method: 'PATCH', body })
export const del = (p: string) => api<void>(p, { method: 'DELETE' })

export const L = (id: number) => `/v1/ledgers/${id}`
