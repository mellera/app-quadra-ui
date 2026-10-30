import { Link } from 'react-router-dom'
import { get, L } from '../lib/api'
import { useBook } from '../lib/book'
import { monthName, monthRange, shortDate, today } from '../lib/dates'
import { useAsync, useIsDesktop } from '../lib/hooks'
import { balanceMap, describe, isMoney, netWorth } from '../lib/ledger'
import { eur, eurSigned } from '../lib/money'
import type { Balance, BudgetPeriod, BudgetPeriodView, Transaction } from '../lib/types'
import { ErrorBox, Loading, NewTxButton, Page, Panel } from '../components/Common'

export function Home() {
  const { ledger, accounts, version } = useBook()
  const desktop = useIsDesktop()
  const range = monthRange()
  const q = useAsync(async () => {
    const base = L(ledger.id)
    const [bal, tot, txs, periods] = await Promise.all([
      get<Balance[]>(`${base}/balances`),
      get<Balance[]>(`${base}/totals?from=${range.from}&to=${range.to}`),
      get<Transaction[]>(`${base}/transactions?limit=6`),
      get<BudgetPeriod[]>(`${base}/budget-periods`),
    ])
    const t = today()
    const cur = periods.find((p) => p.start_on <= t && t <= p.end_on)
    const budget = cur ? await get<BudgetPeriodView>(`${base}/budget-periods/${cur.id}`) : null
    return { bal, tot, txs, budget }
  }, [ledger.id, version])

  if (q.loading && !q.data) return <Page title="Home"><Loading /></Page>
  if (!q.data) return <Page title="Home"><ErrorBox message={q.error} onRetry={q.reload} /></Page>
  const { bal, tot, txs, budget } = q.data
  const totals = balanceMap(tot)
  let income = 0, spent = 0
  for (const a of accounts) {
    if (a.type === 'income') income -= totals.get(a.id) ?? 0
    if (a.type === 'expense') spent += totals.get(a.id) ?? 0
  }
  const bm = balanceMap(bal)
  const money = accounts.filter((a) => isMoney(a) && !a.is_group && (bm.has(a.id) || a.is_active))
  const worth = netWorth(accounts, bal)

  const txRows = txs.map((t) => ({ t, d: describe(t, accounts) }))
  const budgetItems = (budget?.items ?? []).filter((i) => i.kind === 'budget').slice(0, 3)

  return (
    <Page title="Home" sub={monthName(range.from)} action={desktop ? <NewTxButton /> : undefined}>
      {q.error && <ErrorBox message={q.error} onRetry={q.reload} />}
      {desktop ? (
        <section className="kpis">
          <div className="pn kpi"><div className="lbl">Patrimonio netto</div><div className="big">{eur(worth)}</div></div>
          <div className="pn kpi"><div className="lbl">Entrate · mese</div><div className="big pos">{eurSigned(income)}</div></div>
          <div className="pn kpi"><div className="lbl">Spese · mese</div><div className="big neg">{eurSigned(-spent)}</div></div>
          <div className="pn kpi"><div className="lbl">Saldo del mese</div><div className="big">{eurSigned(income - spent)}</div></div>
        </section>
      ) : (
        <div className="pn" style={{ padding: '12px 16px' }}>
          <div className="lbl">Patrimonio netto</div><div className="big">{eur(worth)}</div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <span className="pos amt">{eurSigned(income)} entrate</span><span className="neg amt">{eurSigned(-spent)} spese</span>
          </div>
        </div>
      )}
      <div style={desktop ? { display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 24 } : { display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Panel title="Ultimi movimenti" note={<Link to="/movimenti">Vedi tutti →</Link>} flush>
          {txRows.length === 0 ? <p className="mut" style={{ padding: 12 }}>Nessun movimento: registra il primo con «+».</p> : desktop ? (
            <table className="tbl">
              <thead><tr><th>Data</th><th>Descrizione</th><th>Categoria</th><th>Conto</th><th className="r">Importo</th></tr></thead>
              <tbody>{txRows.map(({ t, d }) => (
                <tr key={t.id}><td>{shortDate(t.booked_on)}</td><td><Link to={`/movimenti/${t.id}`}>{t.description || '—'}</Link></td><td>{d.category}</td><td>{d.account}</td>
                  <td className={`amt ${d.amount < 0 ? 'neg' : d.kind === 'income' ? 'pos' : ''}`}>{d.kind === 'transfer' || d.kind === 'opening' ? eur(d.amount) : eurSigned(d.amount)}</td></tr>
              ))}</tbody>
            </table>
          ) : (
            <div style={{ padding: '0 12px' }}>{txRows.map(({ t, d }) => (
              <Link key={t.id} to={`/movimenti/${t.id}`} className="mrow"><div>{t.description || d.category}<small>{shortDate(t.booked_on)} · {d.category}</small></div>
                <span className={`amt ${d.amount < 0 ? 'neg' : d.kind === 'income' ? 'pos' : ''}`}>{d.kind === 'transfer' || d.kind === 'opening' ? eur(d.amount) : eurSigned(d.amount)}</span></Link>
            ))}</div>
          )}
        </Panel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: desktop ? 24 : 16, minWidth: 0 }}>
          <Panel title="Conti" note="saldo attuale" flush>
            <table className="tbl"><tbody>
              {money.map((a) => <tr key={a.id}><td><Link to={`/conti/${a.id}`}>{a.name}</Link></td><td className="amt">{eur(bm.get(a.id) ?? 0)}</td></tr>)}
            </tbody><tfoot><tr><td>Totale</td><td className="amt">{eur(worth)}</td></tr></tfoot></table>
          </Panel>
          <Panel title="Budget" note={budget ? <Link to="/budget">Tutti →</Link> : undefined}>
            {budgetItems.length === 0 ? <p className="mut" style={{ padding: 12 }}>Nessun budget per questo mese. <Link to="/budget"><u>Creane uno</u></Link>.</p> : (
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {budgetItems.map((i) => {
                  const pct = Math.min(100, Math.round((i.actual_minor / i.amount_minor) * 100))
                  return <div key={i.id}><div className="row" style={{ justifyContent: 'space-between' }}><span>{i.name}</span>
                    <span className={`amt ${i.state === 'over' ? 'neg' : ''}`}>{eur(i.actual_minor)} / {eur(i.amount_minor)}</span></div>
                    <div className="bar"><i className={i.state === 'over' ? 'o' : i.state === 'warning' ? 'w' : ''} style={{ width: `${pct}%` }} /></div></div>
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </Page>
  )
}
