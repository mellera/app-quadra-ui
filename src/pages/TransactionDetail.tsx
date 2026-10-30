import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { del, get, post, L } from '../lib/api'
import { useBook } from '../lib/book'
import { showDate } from '../lib/dates'
import { errText, useAsync } from '../lib/hooks'
import { accountPath, byId } from '../lib/ledger'
import { eurSigned } from '../lib/money'
import type { Transaction } from '../lib/types'
import { ErrorBox, Loading, Page, Panel } from '../components/Common'
import { useUi } from '../components/ui-context'

export function TransactionDetail() {
  const id = Number(useParams().id)
  const { ledger, accounts, counterparties, tags, canWrite, refresh, version } = useBook()
  const { openTx } = useUi()
  const nav = useNavigate()
  const q = useAsync(() => get<Transaction>(`${L(ledger.id)}/transactions/${id}`), [ledger.id, id, version])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (q.loading && !q.data) return <Page title="Movimento"><Loading /></Page>
  if (!q.data) return <Page title="Movimento"><ErrorBox message={q.error || 'Movimento non trovato'} onRetry={q.reload} /><Link to="/movimenti"><u>← Movimenti</u></Link></Page>
  const t = q.data
  const map = byId(accounts)
  const reconciled = t.postings.some((p) => p.reconciliation_id)
  const locked = reconciled || !!t.reversed_by || !!t.reverses_id
  const cp = counterparties.find((c) => c.id === t.counterparty_id)?.name

  async function run(f: () => Promise<unknown>, after: () => void) {
    setBusy(true); setErr('')
    try { await f(); refresh(); after() } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }
  const remove = () => { if (window.confirm('Eliminare questo movimento?')) void run(() => del(`${L(ledger.id)}/transactions/${t.id}`), () => nav('/movimenti', { replace: true })) }
  const reverse = () => { if (window.confirm('Creare lo storno di questo movimento? Verrà registrato un movimento opposto, con la data di oggi.')) void run(() => post<Transaction>(`${L(ledger.id)}/transactions/${t.id}/reverse`, {}), () => q.reload()) }

  return (
    <Page title="Movimento" sub={showDate(t.booked_on)}>
      <Link to="/movimenti"><u>← Movimenti</u></Link>
      <Panel title={t.description || 'Senza descrizione'} note={<>{reconciled && <span className="badge">riconciliato</span>} {t.reversed_by && <Link to={`/movimenti/${t.reversed_by}`}><span className="badge badge-w">stornato</span></Link>} {t.reverses_id && <Link to={`/movimenti/${t.reverses_id}`}><span className="badge badge-o">storno di #{t.reverses_id}</span></Link>}</>} flush>
        <table className="tbl">
          <thead><tr><th>Conto</th><th className="r">Dare / avere</th></tr></thead>
          <tbody>{t.postings.map((p) => (
            <tr key={p.id}><td>{map.get(p.account_id) ? accountPath(map.get(p.account_id)!, map) : '?'}{p.memo && <small className="mut"> · {p.memo}</small>}</td>
              <td className={`amt ${p.amount_minor < 0 ? 'neg' : ''}`}>{eurSigned(p.amount_minor)}</td></tr>
          ))}</tbody>
        </table>
        <div style={{ padding: 12 }} className="mut">
          {cp && <div>Controparte: {cp}</div>}
          {t.tag_ids.length > 0 && <div>{t.tag_ids.map((x) => <span key={x} className="tag">{tags.find((g) => g.id === x)?.name ?? '?'}</span>)}</div>}
          {t.notes && <div>Note: {t.notes}</div>}
        </div>
      </Panel>
      {locked && !t.reverses_id && !t.reversed_by && <div className="notice">Il movimento è riconciliato: per correggerlo crea uno storno.</div>}
      {err && <div className="err" role="alert">{err}</div>}
      {canWrite && (
        <div className="row">
          <button className="btn" disabled={busy || locked} onClick={() => openTx(t)}>Modifica</button>
          <button className="btn" disabled={busy || !!t.reverses_id || !!t.reversed_by} onClick={reverse}>Storna</button>
          <button className="btn btn-d" disabled={busy || locked} onClick={remove}>Elimina</button>
        </div>
      )}
    </Page>
  )
}
