export type AuthConfig = { clientId: string; issuer: string }

/** L'URL dell'API e' noto a build time (unica configurazione di build, pubblica). */
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

/** Issuer e client id non stanno nel codice: li serve il chart a runtime in /auth-config.json. */
export async function loadAuthConfig(): Promise<AuthConfig> {
  const r = await fetch('/auth-config.json', { cache: 'no-store' })
  if (!r.ok) throw new Error('auth-config.json non disponibile')
  const c = (await r.json()) as Partial<AuthConfig>
  if (typeof c.clientId !== 'string' || typeof c.issuer !== 'string' || !c.issuer.startsWith('https://') && !c.issuer.startsWith('http://localhost')) {
    throw new Error('auth-config.json non valido')
  }
  return { clientId: c.clientId, issuer: c.issuer }
}
