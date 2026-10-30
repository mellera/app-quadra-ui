import { useState } from 'react'
import { Link } from 'react-router-dom'
import { get, post, L } from '../lib/api'
import { useBook } from '../lib/book'
import { today } from '../lib/dates'
import { errText, useAsync, useIsDesktop } from '../lib/hooks'
import { TYPE_LABEL, accountPath, balanceMap, byId, netWorth } from '../lib/ledger'
import { eur, parseEur } from '../lib/money'
import type { Account, AccountType, Balance } from '../lib/types'
import { ErrorBox, Field, Loading, Page, Panel } from '../components/Common'

const ORDER: AccountType[] = ['asset', 'liability']

export function Accounts() {
  const { ledger, accounts, canWrite, version } = useBook()
  const [creating, setCreating] = useState(false)
  const q = useAsync(() => get<Balance[]>(`${L(ledger.id)}/balances`), [ledger.id, version])
  if (!q.data) return <Page title="Conti">{q.loading ? <Loading /> : <ErrorBox message={q.error} onRetry={q.reload} />}</Page>
  const bm = balanceMap(q.data)
  const worth = netWorth(accounts, q.data)
  const map = byId(accounts)

  return (
    <Page title="Conti" sub="saldo attuale" action={canWrite ? <button className="btn btn-p" onClick={() => setCreating(true)}>+ Nuovo conto</button> : undefined}>
      {ORDER.map((t) => {
        const list = accounts.filter((a) => a.type === t && !a.is_group)
        const sum = list.reduce((s, a) => s + (bm.get(a.id) ?? 0), 0)
        return (
          <Panel key={t} title={TYPE_LABEL[t]} note={<span className="amt">{eur(sum)}</span>} flush>
            {list.length === 0 ? <p className="mut" style={{ padding: 12 }}>Nessun conto.</p> : (
              <table className="tbl"><tbody>{list.map((a) => (
                <tr key={a.id}><td><Link to={`/conti/${a.id}`}>{accountPath(a, map)}</Link>{!a.is_active && <> <span className="badge badge-o">disattivato</span></>}{a.member_user_id && <> <span className="badge badge-o">membro</span></>}</td>
                  <td className={`amt ${(bm.get(a.id) ?? 0) < 0 ? 'neg' : ''}`}>{eur(bm.get(a.id) ?? 0)}</td></tr>
              ))}</tbody></table>
            )}
          </Panel>
        )
      })}
      <div className="pn"><div className="li"><strong>Patrimonio netto</strong><span className="amt big" style={{ fontSize: 18 }}>{eur(worth)}</span></div></div>
      {creating && <NewAccount onClose={() => setCreating(false)} />}
    </Page>
  )
}

function NewAccount({ onClose }: { onClose: () => void }) {
  const { ledger, accounts, refresh } = useBook()
  const desktop = useIsDesktop()
  const groups = accounts.filter((a) => a.is_group && (a.type === 'asset' || a.type === 'liability'))
  const [parent, setParent] = useState(groups[0]?.id ?? 0)
  const [name, setName] = useState('')
  const [initial, setInitial] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const map = byId(accounts)
  const parentAcc = map.get(parent)

  async function save() {
    setErr('')
    if (!name.trim()) return setErr('Dai un nome al conto.')
    const amount = initial.trim() ? parseEur(initial) : 0
    if (amount === null) return setErr('Saldo iniziale non valido.')
    setBusy(true)
    try {
      const acc = await post<Account>(`${L(ledger.id)}/accounts`, { parent_id: parent || null, name: name.trim(), type: parentAcc?.type ?? 'asset', is_group: false })
      if (amount > 0) {
        // il saldo iniziale e' un normale movimento dal conto "Saldi iniziali" (patrimonio netto)
        const equity = accounts.find((a) => a.type === 'equity' && !a.is_group && a.is_active)
        if (!equity) throw new Error('Manca il conto «Saldi iniziali».')
        const liability = acc.type === 'liability'
        await post(`${L(ledger.id)}/transactions`, {
          kind: 'opening', booked_on: today(), description: `Saldo iniziale ${acc.name}`, counterparty_id: null, notes: '', tag_ids: [], amount_minor: amount,
          from_account_id: liability ? acc.id : equity.id, to_account_id: liability ? equity.id : acc.id, splits: [],
        })
      }
      refresh(); onClose()
    } catch (e) { setErr(e instanceof Error && !('status' in e) ? e.message : errText(e)) } finally { setBusy(false) }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="pn drawer" role="dialog" aria-modal="true" aria-label="Nuovo conto" style={desktop ? undefined : undefined}>
        <div className="ph" style={{ padding: '16px 20px', fontSize: 14 }}><span>Nuovo conto</span><button className="btn btn-s" onClick={onClose} aria-label="Chiudi">✕</button></div>
        <div className="body">
          <Field label="Gruppo"><select className="inp" value={parent} onChange={(e) => setParent(Number(e.target.value))}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
          <Field label="Nome"><input className="inp" autoFocus maxLength={255} value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Revolut" /></Field>
          <Field label="Saldo iniziale (facoltativo)"><input className="inp" inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="0,00" /></Field>
          <p className="mut" style={{ fontSize: 12 }}>Per un conto come Revolut inserisci il valore versato: il saldo iniziale si registra come movimento datato oggi.</p>
          {err && <div className="err" role="alert">{err}</div>}
        </div>
        <div className="foot"><span /><div className="row"><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-p" disabled={busy} onClick={() => void save()}>{busy ? 'Salvo…' : 'Crea conto'}</button></div></div>
      </aside>
    </>
  )
}
