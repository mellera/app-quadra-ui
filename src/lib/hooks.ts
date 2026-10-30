import { useCallback, useEffect, useState } from 'react'
import { ApiError } from './api'

export function useIsDesktop(): boolean {
  const q = '(min-width: 900px)'
  const [d, setD] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const f = () => setD(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return d
}

export interface Async<T> { data: T | undefined; error: string; loading: boolean; reload: () => void }

/** Carica dati all'avvio e quando cambiano le dipendenze; un errore non lascia mai la pagina vuota. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): Async<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [n, setN] = useState(0)
  useEffect(() => {
    let alive = true
    setLoading(true)
    fn()
      .then((d) => { if (alive) { setData(d); setError('') } })
      .catch((e) => { if (alive) setError(e instanceof ApiError ? e.display : 'Errore imprevisto') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n])
  const reload = useCallback(() => setN((x) => x + 1), [])
  return { data, error, loading, reload }
}

export const errText = (e: unknown) => (e instanceof ApiError ? e.display : 'Errore imprevisto')
