import { Link, useParams } from 'react-router-dom'
import { get, L } from '../lib/api'
import { useBook } from '../lib/book'
import { shortDate, showDate } from '../lib/dates'
import { useAsync, useIsDesktop } from '../lib/hooks'
import { eur, eurSigned } from '../lib/money'
import type { Balance, Transaction } from '../lib/types'
import { ErrorBox, Loading, Page, Panel } from '../components/Common'

export function AccountDetail() {
  const id = Number(useParams().id)
  const { ledger, accounts, canWrite, version } = useBook()
  const desktop = useIsDesktop()
  const acc = accounts.find((a) => a.id === id)
  const q = useAsync(async () => {
    const [bal, txs] = await Promise.all([get<Balance[]>(`${L(ledger.id)}/balances`), get<Transaction[]>(`${L(ledger.id)}/transactions?account_id=${id}&limit=100`)])
    return { balance: bal.find((b) => b.account_id === id)?.amount_minor ?? 0, txs }
  }, [ledger.id, id, version])

  if (!acc) return <Page title="Conto"><ErrorBox message="Conto non trovato." /><Link to="/conti"><u>← Conti</u></Link></Page>
  const reconcilable = acc.type === 'asset' || acc.type === 'liability'
  return (
    <Page title={acc.name} sub="dettaglio conto" action={desktop && canWrite && reconcilable ? <Link className="btn" to={`/conti/${id}/riconcilia`}>Riconcilia</Link> : undefined}>
      <Link to="/conti"><u>← Conti</u></Link>
      {!q.data ? (q.loading ? <Loading /> : <ErrorBox message={q.error} onRetry={q.reload} />) : (
        <>
          <div className="pn kpi"><div className="lbl">Saldo</div><div className="big">{eur(q.data.balance)}</div></div>
          <Panel title="Movimenti del conto" note={`${q.data.txs.length} mostrati`} flush>
            {q.data.txs.length === 0 ? <p className="mut" style={{ padding: 12 }}>Nessun movimento su questo conto.</p> : (
              <table className="tbl"><thead><tr><th>Data</th><th>Descrizione</th><th className="r">Importo</th></tr></thead>
                <tbody>{q.data.txs.map((t) => {
                  const amount = t.postings.filter((p) => p.account_id === id).reduce((s, p) => s + p.amount_minor, 0)
                  const rec = t.postings.some((p) => p.account_id === id && p.reconciliation_id)
                  return <tr key={t.id}><td>{desktop ? showDate(t.booked_on) : shortDate(t.booked_on)}</td>
                    <td><Link to={`/movimenti/${t.id}`}>{t.description || '—'}</Link>{rec && <> <span className="badge">riconciliato</span></>}</td>
                    <td className={`amt ${amount < 0 ? 'neg' : 'pos'}`}>{eurSigned(amount)}</td></tr>
                })}</tbody></table>
            )}
          </Panel>
          {!desktop && reconcilable && <p className="mut">La riconciliazione con l'estratto conto si fa dal computer.</p>}
        </>
      )}
    </Page>
  )
}
