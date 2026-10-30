import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { get, L } from './api'
import { errText } from './hooks'
import type { Account, Ledger, Named, User } from './types'

interface BookValue {
  user: User
  ledgers: Ledger[]
  ledger: Ledger
  setLedger: (id: number) => void
  accounts: Account[]
  counterparties: Named[]
  tags: Named[]
  canWrite: boolean
  version: number
  /** Da chiamare dopo ogni modifica: ricarica anagrafiche e dati delle pagine. */
  refresh: () => void
  refreshLedgers: () => void
}

const Ctx = createContext<BookValue | null>(null)
export const useBook = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('BookProvider mancante')
  return v
}

const KEY = 'quadra.activeLedger'
const remembered = (): number | null => {
  try { return Number(localStorage.getItem(KEY)) || null } catch { return null }
}

/** Carica utente, libri e anagrafiche del libro attivo. Il libro attivo si ricorda per dispositivo. */
export function BookProvider({ children, fallback }: { children: ReactNode; fallback: (msg: string, loading: boolean) => ReactNode }) {
  const [user, setUser] = useState<User>()
  const [ledgers, setLedgers] = useState<Ledger[]>([])
  const [activeId, setActiveId] = useState<number | null>(remembered)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [counterparties, setCp] = useState<Named[]>([])
  const [tags, setTags] = useState<Named[]>([])
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [ledgersVersion, setLedgersVersion] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([get<User>('/v1/me'), get<Ledger[]>('/v1/ledgers')])
      .then(([u, ls]) => { if (alive) { setUser(u); setLedgers(ls) } })
      .catch((e) => { if (alive) setError(errText(e)) })
    return () => { alive = false }
  }, [ledgersVersion])

  const ledger = useMemo(() => ledgers.find((l) => l.id === activeId) ?? ledgers[0], [ledgers, activeId])

  useEffect(() => {
    if (!ledger) return
    let alive = true
    Promise.all([get<Account[]>(`${L(ledger.id)}/accounts`), get<Named[]>(`${L(ledger.id)}/counterparties`), get<Named[]>(`${L(ledger.id)}/tags`)])
      .then(([a, c, t]) => { if (alive) { setAccounts(a); setCp(c); setTags(t); setReady(true); setError('') } })
      .catch((e) => { if (alive) setError(errText(e)) })
    return () => { alive = false }
  }, [ledger, version])

  const setLedger = useCallback((id: number) => {
    setReady(false)
    setActiveId(id)
    try { localStorage.setItem(KEY, String(id)) } catch { /* storage non disponibile */ }
  }, [])
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const refreshLedgers = useCallback(() => setLedgersVersion((v) => v + 1), [])

  if (error && !ready) return <>{fallback(error, false)}</>
  if (!user || !ledger || !ready) return <>{fallback('Caricamento…', true)}</>
  return (
    <Ctx.Provider value={{ user, ledgers, ledger, setLedger, accounts, counterparties, tags, canWrite: ledger.role !== 'viewer', version, refresh, refreshLedgers }}>
      {children}
    </Ctx.Provider>
  )
}
