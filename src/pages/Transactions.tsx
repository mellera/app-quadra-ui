import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { get, L } from '../lib/api'
import { useBook } from '../lib/book'
import { shortDate, showDate } from '../lib/dates'
import { useAsync, useIsDesktop } from '../lib/hooks'
import { accountPath, byId, describe, postable } from '../lib/ledger'
import { eur, eurSigned } from '../lib/money'
import type { Transaction } from '../lib/types'
import { ErrorBox, Loading, NewTxButton, Page } from '../components/Common'

const PAGE = 50

export function Transactions() {
  const { ledger, accounts, version } = useBook()
  const desktop = useIsDesktop()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [account, setAccount] = useState(0)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [extra, setExtra] = useState<Transaction[]>([])
  const [more, setMore] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const params = (offset: number) => {
    const p = new URLSearchParams({ limit: String(PAGE), offset: String(offset) })
    if (q.trim()) p.set('q', q.trim())
    if (account) p.set('account_id', String(account))
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    return p.toString()
  }
  const first = useAsync(async () => {
    setExtra([]); setMore(true)
    const r = await get<Transaction[]>(`${L(ledger.id)}/transactions?${params(0)}`)
    setMore(r.length === PAGE)
    return r
  }, [ledger.id, version, q, account, from, to])

  const rows = [...(first.data ?? []), ...extra]
  async function loadMore() {
    setBusy(true); setErr('')
    try {
      const r = await get<Transaction[]>(`${L(ledger.id)}/transactions?${params(rows.length)}`)
      setExtra([...extra, ...r]); setMore(r.length === PAGE)
    } catch { setErr('Non riesco a caricare altri movimenti.') } finally { setBusy(false) }
  }

  const map = byId(accounts)
  return (
    <Page title="Movimenti" action={desktop ? <NewTxButton /> : undefined}>
      <section className="pn" style={{ padding: 12 }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="fld" style={{ flex: '1 1 200px' }}><span className="lbl">Cerca</span><input className="inp" type="search" maxLength={100} placeholder="Descrizione" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <label className="fld" style={{ flex: '1 1 200px' }}><span className="lbl">Conto o categoria</span>
            <select className="inp" value={account} onChange={(e) => setAccount(Number(e.target.value))}>
              <option value={0}>Tutti</option>{postable(accounts).map((a) => <option key={a.id} value={a.id}>{accountPath(a, map)}</option>)}
            </select></label>
          <label className="fld"><span className="lbl">Dal</span><input className="inp" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="fld"><span className="lbl">Al</span><input className="inp" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      </section>
      {first.loading && !first.data ? <Loading /> : first.error && !first.data ? <ErrorBox message={first.error} onRetry={first.reload} /> : (
        <section className="pn">
          {rows.length === 0 ? <p className="mut" style={{ padding: 12 }}>Nessun movimento con questi filtri.</p> : desktop ? (
            <table className="tbl">
              <thead><tr><th>Data</th><th>Descrizione</th><th>Categoria</th><th>Conto</th><th className="r">Importo</th></tr></thead>
              <tbody>{rows.map((t) => {
                const d = describe(t, accounts)
                return (
                  <tr key={t.id} className="click" onClick={() => nav(`/movimenti/${t.id}`)}>
                    <td>{showDate(t.booked_on)}</td>
                    <td><Link to={`/movimenti/${t.id}`}>{t.description || '—'}</Link>{t.reverses_id && <> <span className="badge badge-o">storno</span></>}{t.reversed_by && <> <span className="badge badge-o">stornato</span></>}</td>
                    <td>{d.category}</td><td>{d.account}</td>
                    <td className={`amt ${d.amount < 0 ? 'neg' : d.kind === 'income' ? 'pos' : ''}`}>{d.kind === 'transfer' || d.kind === 'opening' ? eur(d.amount) : eurSigned(d.amount)}</td>
                  </tr>
                )
              })}</tbody>
            </table>
          ) : (
            <div style={{ padding: '0 12px' }}>{rows.map((t) => {
              const d = describe(t, accounts)
              return <Link key={t.id} to={`/movimenti/${t.id}`} className="mrow"><div>{t.description || d.category}<small>{shortDate(t.booked_on)} · {d.category}{t.reversed_by ? ' · stornato' : ''}</small></div>
                <span className={`amt ${d.amount < 0 ? 'neg' : d.kind === 'income' ? 'pos' : ''}`}>{d.kind === 'transfer' || d.kind === 'opening' ? eur(d.amount) : eurSigned(d.amount)}</span></Link>
            })}</div>
          )}
          {more && rows.length > 0 && <div style={{ padding: 12 }}><button className="btn" disabled={busy} onClick={() => void loadMore()}>{busy ? 'Carico…' : 'Carica altri'}</button> {err && <span className="neg">{err}</span>}</div>}
        </section>
      )}
    </Page>
  )
}
