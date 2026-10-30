import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from 'oidc-client-ts'
import { configureApi } from './api'
import { loadAuthConfig } from './config'

type Status = 'loading' | 'anonymous' | 'authenticated' | 'error'
interface AuthValue {
  status: Status
  error: string
  login: (returnTo?: string) => void
  logout: () => void
  finishLogin: () => Promise<string>
}

const Ctx = createContext<AuthValue | null>(null)
export const useAuth = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('AuthProvider mancante')
  return v
}

/** Solo percorsi interni: niente redirect aperti. */
export function safeReturn(p: unknown): string {
  return typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') && !p.startsWith('/\\') && !p.startsWith('/auth/') ? p : '/'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')
  const mgr = useRef<UserManager | null>(null)
  const user = useRef<User | null>(null)

  useEffect(() => {
    configureApi(
      () => user.current?.access_token ?? null,
      () => { user.current = null; setStatus('anonymous') },
    )
    let alive = true
    loadAuthConfig()
      .then((c) => {
        if (!alive) return
        // Il token resta solo in memoria (mai in localStorage); in sessionStorage c'e' soltanto lo stato PKCE.
        const m = new UserManager({
          authority: c.issuer,
          client_id: c.clientId,
          redirect_uri: `${window.location.origin}/auth/callback`,
          post_logout_redirect_uri: `${window.location.origin}/`,
          response_type: 'code',
          scope: 'openid profile email',
          automaticSilentRenew: true,
          filterProtocolClaims: true,
          userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
          stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
        })
        m.events.addUserLoaded((u) => { user.current = u; setStatus('authenticated') })
        m.events.addUserUnloaded(() => { user.current = null; setStatus('anonymous') })
        m.events.addSilentRenewError(() => { user.current = null; setStatus('anonymous') })
        mgr.current = m
        if (window.location.pathname !== '/auth/callback') setStatus('anonymous')
        else setStatus('loading')
      })
      .catch(() => { if (alive) { setError('Configurazione di accesso non disponibile.'); setStatus('error') } })
    return () => { alive = false }
  }, [])

  const login = useCallback((returnTo = '/') => {
    mgr.current?.signinRedirect({ state: safeReturn(returnTo) }).catch(() => { setError('Accesso non riuscito.'); setStatus('error') })
  }, [])

  const logout = useCallback(() => {
    const m = mgr.current
    user.current = null
    setStatus('anonymous')
    m?.signoutRedirect().catch(() => {})
  }, [])

  const finishLogin = useCallback(async () => {
    try {
      const u = await mgr.current!.signinRedirectCallback()
      user.current = u
      setStatus('authenticated')
      return safeReturn(u.state)
    } catch {
      setError('Accesso non riuscito: riprova.')
      setStatus('error')
      return '/'
    }
  }, [])

  const value = useMemo(() => ({ status, error, login, logout, finishLogin }), [status, error, login, logout, finishLogin])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
