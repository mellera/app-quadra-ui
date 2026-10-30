import { useState } from 'react'
import { get, L } from '../lib/api'
import { useBook } from '../lib/book'
import { addMonths, monthName, monthRange } from '../lib/dates'
import { useAsync, useIsDesktop } from '../lib/hooks'
import { accountPath, byId } from '../lib/ledger'
import { eur } from '../lib/money'
import type { Balance } from '../lib/types'
import { DesktopOnly, ErrorBox, Loading, Page, Panel } from '../components/Common'

export function Report() {
  const desktop = useIsDesktop()
  const { ledger, accounts, version } = useBook()
  const [month, setMonth] = useState(monthRange().from)
  const { from, to } = monthRange(month)
  const q = useAsync(() => get<Balance[]>(`${L(ledger.id)}/totals?from=${from}&to=${to}`), [ledger.id, from, to, version])
  if (!desktop) return <Page title="Report"><DesktopOnly what="Il report" /></Page>

  const map = byId(accounts)
  const sum = (t: string) => (q.data ?? []).filter((b) => map.get(b.account_id)?.type === t)
  // income ha segno negativo (credito), expense positivo (debito): si mostrano come importi positivi
  const income = sum('income').map((b) => ({ id: b.account_id, v: -b.amount_minor })).filter((r) => r.v !== 0)
  const expense = sum('expense').map((b) => ({ id: b.account_id, v: b.amount_minor })).filter((r) => r.v !== 0).sort((a, b) => b.v - a.v)
  const tin = income.reduce((s, r) => s + r.v, 0)
  const tout = expense.reduce((s, r) => s + r.v, 0)
  const max = Math.max(1, ...expense.map((r) => r.v))

  return (
    <Page title="Report" sub={monthName(from)} action={
      <div className="row"><button className="btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mese precedente">←</button>
        <button className="btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mese successivo">→</button></div>}>
      {q.loading && !q.data ? <Loading /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> : (
        <>
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
            <div className="pn kpi"><div className="lbl">Entrate</div><div className="big pos">{eur(tin)}</div></div>
            <div className="pn kpi"><div className="lbl">Spese</div><div className="big neg">{eur(tout)}</div></div>
            <div className="pn kpi"><div className="lbl">Risparmio</div><div className={`big ${tin - tout < 0 ? 'neg' : 'pos'}`}>{eur(tin - tout)}</div></div>
          </div>
          <Panel title="Spese per categoria">
            {expense.length === 0 ? <p className="mut" style={{ padding: 12 }}>Nessuna spesa nel mese.</p> : (
              <svg role="img" aria-label="Spese per categoria" width="100%" height={expense.length * 28 + 8} style={{ display: 'block', padding: 12 }}>
                {expense.map((r, i) => (
                  <g key={r.id} transform={`translate(0 ${i * 28 + 4})`}>
                    <text x="0" y="14" fontSize="12" fill="var(--ink)">{accountPath(map.get(r.id)!, map)}</text>
                    <rect x="38%" y="2" height="16" width={`${(r.v / max) * 40}%`} fill="var(--accent)" />
                    <text x="98%" y="14" fontSize="12" textAnchor="end" fill="var(--ink)">{eur(r.v)}</text>
                  </g>
                ))}
              </svg>
            )}
          </Panel>
          <Panel title="Entrate per categoria" flush>
            {income.length === 0 ? <p className="mut" style={{ padding: 12 }}>Nessuna entrata nel mese.</p> :
              <table className="tbl"><tbody>{income.map((r) => <tr key={r.id}><td>{accountPath(map.get(r.id)!, map)}</td><td className="amt pos">{eur(r.v)}</td></tr>)}</tbody></table>}
          </Panel>
        </>
      )}
    </Page>
  )
}
