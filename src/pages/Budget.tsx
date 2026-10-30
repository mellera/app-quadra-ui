import { useState } from 'react'
import { del, get, post, L } from '../lib/api'
import { useBook } from '../lib/book'
import { addMonths, monthName, monthRange, showDate } from '../lib/dates'
import { errText, useAsync } from '../lib/hooks'
import { accountPath, byId, postable } from '../lib/ledger'
import { eur } from '../lib/money'
import { parseEur } from '../lib/money'
import type { BudgetItem, BudgetPeriod, BudgetPeriodView } from '../lib/types'
import { ErrorBox, Field, Loading, Page, Panel } from '../components/Common'

const STATE: Record<BudgetItem['state'], { label: string; cls: string }> = {
  ok: { label: 'nei limiti', cls: 'i' }, warning: { label: 'quasi esaurito', cls: 'w' }, over: { label: 'superato', cls: 'o' },
  in_progress: { label: 'in corso', cls: 'i' }, reached: { label: 'raggiunto', cls: 't' },
}

export function Budget() {
  const { ledger, canWrite, version, refresh } = useBook()
  const [sel, setSel] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const list = useAsync(() => get<BudgetPeriod[]>(`${L(ledger.id)}/budget-periods`), [ledger.id, version])
  const current = sel ?? list.data?.[0]?.id ?? null
  const view = useAsync(async () => (current ? get<BudgetPeriodView>(`${L(ledger.id)}/budget-periods/${current}`) : null), [ledger.id, current, version])

  async function newMonth() {
    const base = list.data?.[0]?.start_on
    const { from, to } = monthRange(base ? addMonths(base, 1) : undefined)
    try {
      const p = await post<BudgetPeriod>(`${L(ledger.id)}/budget-periods`, { name: monthName(from), start_on: from, end_on: to })
      setSel(p.id); refresh()
    } catch (e) { alert(errText(e)) }
  }

  if (list.loading && !list.data) return <Page title="Budget"><Loading /></Page>
  if (list.error) return <Page title="Budget"><ErrorBox message={list.error} onRetry={list.reload} /></Page>
  return (
    <Page title="Budget" sub="previsto e reale" action={canWrite ? <button className="btn btn-p" onClick={() => void newMonth()}>+ Nuovo periodo</button> : undefined}>
      {(list.data ?? []).length === 0 ? <p className="mut">Nessun periodo. Crea il primo per fissare budget di spesa e target di entrata.</p> : (
        <div className="row">
          <select className="inp" style={{ maxWidth: 260 }} aria-label="Periodo" value={current ?? ''} onChange={(e) => setSel(Number(e.target.value))}>
            {list.data!.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {view.data && <span className="mut">{showDate(view.data.start_on)} – {showDate(view.data.end_on)}</span>}
        </div>
      )}
      {view.data && (
        <Panel title="Voci" note={canWrite ? <button className="btn btn-s" onClick={() => setAdding(true)}>+ Voce</button> : undefined}>
          {view.data.items.length === 0 ? <p className="mut" style={{ padding: 12 }}>Nessuna voce.</p> : view.data.items.map((it) => <Item key={it.id} it={it} canWrite={canWrite} onChange={refresh} />)}
        </Panel>
      )}
      {view.data && canWrite && (
        <button className="btn" onClick={async () => { if (confirm('Eliminare il periodo e le sue voci? I movimenti restano.')) { try { await del(`${L(ledger.id)}/budget-periods/${view.data!.id}`); setSel(null); refresh() } catch (e) { alert(errText(e)) } } }}>Elimina periodo</button>
      )}
      {adding && view.data && <ItemForm periodId={view.data.id} onClose={() => setAdding(false)} />}
    </Page>
  )
}

function Item({ it, canWrite, onChange }: { it: BudgetItem; canWrite: boolean; onChange: () => void }) {
  const { ledger } = useBook()
  const pct = it.amount_minor > 0 ? Math.min(100, Math.round((it.actual_minor / it.amount_minor) * 100)) : 0
  const st = STATE[it.state]
  const bar = it.state === 'over' ? 'o' : it.state === 'warning' ? 'w' : it.state === 'reached' ? 't' : ''
  return (
    <div className="li" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div className="li" style={{ padding: 0, border: 0 }}>
        <span>{it.name} <span className={`badge ${st.cls === 'o' ? 'badge-w' : ''}`}>{st.label}</span><small>{it.kind === 'budget' ? 'budget di spesa' : 'target di entrata'}</small></span>
        <span className="amt">{eur(it.actual_minor)} / {eur(it.amount_minor)}</span>
      </div>
      <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={it.name}><i className={bar} style={{ width: `${pct}%` }} /></div>
      <div className="li" style={{ padding: 0, border: 0 }}>
        <small>{it.remaining_minor >= 0 ? `Restano ${eur(it.remaining_minor)}` : `Oltre di ${eur(-it.remaining_minor)}`}</small>
        {canWrite && <button className="btn btn-s" onClick={async () => { if (confirm(`Eliminare «${it.name}»?`)) { try { await del(`${L(ledger.id)}/budget-items/${it.id}`); onChange() } catch (e) { alert(errText(e)) } } }}>Elimina</button>}
      </div>
    </div>
  )
}

function ItemForm({ periodId, onClose }: { periodId: number; onClose: () => void }) {
  const { ledger, accounts, refresh } = useBook()
  const [kind, setKind] = useState<'budget' | 'target'>('budget')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [ids, setIds] = useState<number[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const map = byId(accounts)
  const cats = postable(accounts).filter((a) => a.type === (kind === 'budget' ? 'expense' : 'income'))

  async function save() {
    const minor = parseEur(amount)
    if (!name.trim()) return setErr('Dai un nome alla voce.')
    if (minor === null || minor <= 0) return setErr('Importo non valido.')
    if (ids.length === 0) return setErr('Scegli almeno una categoria.')
    setBusy(true); setErr('')
    try { await post(`${L(ledger.id)}/budget-periods/${periodId}/items`, { kind, name: name.trim(), amount_minor: minor, account_ids: ids }); refresh(); onClose() }
    catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="pn drawer" role="dialog" aria-modal="true" aria-label="Nuova voce">
        <div className="ph" style={{ padding: '16px 20px', fontSize: 14 }}><span>Nuova voce</span><button className="btn btn-s" onClick={onClose} aria-label="Chiudi">✕</button></div>
        <div className="body">
          <div className="seg"><button className={kind === 'budget' ? 'on' : ''} onClick={() => { setKind('budget'); setIds([]) }}>Budget spesa</button><button className={kind === 'target' ? 'on' : ''} onClick={() => { setKind('target'); setIds([]) }}>Target entrata</button></div>
          <Field label="Nome"><input className="inp" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Importo"><input className="inp" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></Field>
          <fieldset style={{ border: 0, padding: 0 }}><legend className="lbl">Categorie incluse</legend>
            {cats.map((a) => <label key={a.id} className="row" style={{ padding: '4px 0' }}><input className="chk" type="checkbox" checked={ids.includes(a.id)} onChange={() => setIds(ids.includes(a.id) ? ids.filter((x) => x !== a.id) : [...ids, a.id])} />{accountPath(a, map)}</label>)}
          </fieldset>
          {err && <div className="err" role="alert">{err}</div>}
        </div>
        <div className="foot"><span /><div className="row"><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-p" disabled={busy} onClick={() => void save()}>Salva</button></div></div>
      </aside>
    </>
  )
}
