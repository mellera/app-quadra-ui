import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { del, post, put, L } from '../lib/api'
import { useBook } from '../lib/book'
import { showDate, today } from '../lib/dates'
import { errText, useIsDesktop } from '../lib/hooks'
import { eur, eurSigned, parseEur } from '../lib/money'
import type { ReconciliationView } from '../lib/types'
import { DesktopOnly, ErrorBox, Field, Page, Panel } from '../components/Common'

export function Reconcile() {
  const accountId = Number(useParams().id)
  const { ledger, accounts, canWrite, refresh } = useBook()
  const desktop = useIsDesktop()
  const nav = useNavigate()
  const acc = accounts.find((a) => a.id === accountId)
  const [view, setView] = useState<ReconciliationView>()
  const [date, setDate] = useState(today())
  const [balance, setBalance] = useState('')
  const [ticked, setTicked] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (!desktop) return <Page title="Riconciliazione"><DesktopOnly what="La riconciliazione" /></Page>
  if (!acc) return <Page title="Riconciliazione"><ErrorBox message="Conto non trovato." /></Page>
  if (!canWrite) return <Page title="Riconciliazione"><ErrorBox message="Non hai i permessi per riconciliare in questo libro." /></Page>

  const base = L(ledger.id)
  async function run<T>(f: () => Promise<T>): Promise<T | undefined> {
    setBusy(true); setErr('')
    try { return await f() } catch (e) { setErr(errText(e)); return undefined } finally { setBusy(false) }
  }
  const adopt = (v: ReconciliationView) => { setView(v); setTicked(new Set(v.candidates.filter((c) => c.ticked).map((c) => c.posting_id))) }

  async function start() {
    const minor = parseEur(balance.replace(/^−|^-/, ''))
    if (minor === null) return setErr('Saldo dell\'estratto conto non valido.')
    const signed = /^[−-]/.test(balance.trim()) ? -minor : minor
    const v = await run(() => post<ReconciliationView>(`${base}/reconciliations`, { account_id: accountId, statement_date: date, statement_balance_minor: signed }))
    if (v) adopt(v)
  }
  async function toggle(id: number) {
    if (!view) return
    const next = new Set(ticked)
    if (next.has(id)) next.delete(id); else next.add(id)
    setTicked(next)
    const v = await run(() => put<ReconciliationView>(`${base}/reconciliations/${view.id}/ticked`, { posting_ids: [...next] }))
    if (v) adopt(v); else setTicked(ticked)
  }
  async function close() {
    if (!view) return
    const v = await run(() => post<ReconciliationView>(`${base}/reconciliations/${view.id}/close`, {}))
    if (v) { refresh(); adopt(v) }
  }
  async function cancel() {
    if (view && !view.closed) await run(() => del(`${base}/reconciliations/${view.id}`))
    nav(`/conti/${accountId}`)
  }

  return (
    <Page title="Riconciliazione" sub={acc.name} action={<button className="btn" onClick={() => void cancel()}>{view?.closed ? 'Fine' : 'Annulla'}</button>}>
      <Link to={`/conti/${accountId}`}><u>← {acc.name}</u></Link>
      {!view ? (
        <Panel title="1 · Estratto conto">
          <div className="row" style={{ padding: 12, alignItems: 'flex-end' }}>
            <Field label="Data estratto conto"><input className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Saldo estratto conto"><input className="inp" inputMode="decimal" placeholder="0,00" value={balance} onChange={(e) => setBalance(e.target.value)} /></Field>
            <button className="btn btn-p" disabled={busy} onClick={() => void start()}>Inizia</button>
          </div>
          {err && <div className="err" style={{ margin: 12 }} role="alert">{err}</div>}
        </Panel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.8fr) minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
          <Panel title="2 · Movimenti da riconciliare" note={`fino al ${showDate(view.statement_date)}`} flush>
            <table className="tbl">
              <thead><tr><th style={{ width: 40 }} /><th>Data</th><th>Descrizione</th><th className="r">Importo</th></tr></thead>
              <tbody>{view.candidates.map((c) => (
                <tr key={c.posting_id}>
                  <td><input className="chk" type="checkbox" disabled={view.closed || busy} checked={ticked.has(c.posting_id)} onChange={() => void toggle(c.posting_id)} aria-label={`Spunta ${c.description}`} /></td>
                  <td>{showDate(c.booked_on)}</td><td><Link to={`/movimenti/${c.transaction_id}`}>{c.description || '—'}</Link></td>
                  <td className={`amt ${c.amount_minor < 0 ? 'neg' : 'pos'}`}>{eurSigned(c.amount_minor)}</td>
                </tr>
              ))}</tbody>
            </table>
          </Panel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Panel title="3 · Confronto" flush>
              <table className="tbl"><tbody>
                <tr><td>Saldo calcolato (movimenti spuntati)</td><td className="amt">{eur(view.calculated_minor)}</td></tr>
                <tr><td>Saldo estratto conto</td><td className="amt">{eur(view.statement_balance_minor)}</td></tr>
              </tbody><tfoot><tr><td className={view.difference_minor ? 'neg' : 'pos'}>Differenza</td><td className={`amt ${view.difference_minor ? 'neg' : 'pos'}`}>{eur(view.difference_minor)}</td></tr></tfoot></table>
            </Panel>
            <div className="pn" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {view.closed ? <p>Riconciliazione chiusa: i movimenti spuntati sono protetti.</p> : view.difference_minor !== 0
                ? <p>La differenza non è zero: la riconciliazione non si può chiudere. Controlla i movimenti non spuntati o aggiungine di mancanti.</p>
                : <p>La differenza è zero: puoi chiudere.</p>}
              {err && <div className="err" role="alert">{err}</div>}
              {!view.closed && <button className="btn btn-p" style={{ minHeight: 44 }} disabled={busy || view.difference_minor !== 0} onClick={() => void close()}>4 · Chiudi riconciliazione</button>}
              <p className="mut" style={{ fontSize: 12 }}>Alla chiusura i movimenti spuntati diventano protetti: per correggerli servirà uno storno.</p>
            </div>
          </div>
        </div>
      )}
    </Page>
  )
}
