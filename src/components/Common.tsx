import type { ReactNode } from 'react'
import { useBook } from '../lib/book'
import { useIsDesktop } from '../lib/hooks'
import { useUi } from './ui-context'

export function Loading() { return <p className="mut" role="status">Caricamento…</p> }

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="err" role="alert">
      {message} {onRetry && <button className="btn btn-s" onClick={onRetry}>Riprova</button>}
    </div>
  )
}

export function Panel({ title, note, children, flush }: { title: string; note?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className="pn">
      <div className="ph"><span>{title}</span>{note !== undefined && <em>{note}</em>}</div>
      {flush ? children : children}
    </section>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="fld"><span className="lbl">{label}</span>{children}</label>
}

/** Intestazione e contenuto di una pagina, desktop o mobile secondo lo schermo. */
export function Page({ title, sub, action, children }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  const desktop = useIsDesktop()
  const { ledgers, ledger, setLedger } = useBook()
  if (desktop) {
    return (
      <>
        {ledger.role === 'viewer' && <div className="ro">Sola consultazione: non puoi modificare questo libro.</div>}
        <header className="top"><h1>{title}{sub && <small>{sub}</small>}</h1>{action}</header>
        <div className="content">{children}</div>
      </>
    )
  }
  return (
    <>
      <header className="mhead">
        <h1>{title}</h1>
        <select className="mbook" aria-label="Libro" value={ledger.id} onChange={(e) => setLedger(Number(e.target.value))}>
          {ledgers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </header>
      {ledger.role === 'viewer' && <div className="ro">Sola consultazione</div>}
      <div className="mbody">
        {sub && <span className="mut">{sub}</span>}
        {action && <div>{action}</div>}
        {children}
      </div>
    </>
  )
}

export function NewTxButton() {
  const { canWrite } = useBook()
  const { openTx } = useUi()
  if (!canWrite) return null
  return <button className="btn btn-p" onClick={() => openTx()}>+ Nuovo movimento</button>
}

export function DesktopOnly({ what }: { what: string }) {
  return (
    <div className="centerwrap">
      <div className="pn" style={{ padding: 24, maxWidth: 360 }}>
        <p className="lbl">Solo da computer</p>
        <p style={{ margin: '8px 0' }}>{what} si usa dal computer: servono uno schermo largo e la tastiera.</p>
        <p className="mut">Dal telefono puoi registrare movimenti e consultare saldi e budget.</p>
      </div>
    </div>
  )
}
