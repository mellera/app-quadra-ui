import { useMemo, useState } from 'react'
import { post, put, L } from '../lib/api'
import { useBook } from '../lib/book'
import { today } from '../lib/dates'
import { errText } from '../lib/hooks'
import { accountPath, byId, inferInput, isMoney, postable } from '../lib/ledger'
import { eur, parseEur } from '../lib/money'
import type { Account, Named, Transaction, TxKind } from '../lib/types'
import { Field } from './Common'

const KINDS: { k: TxKind; label: string }[] = [{ k: 'expense', label: 'Spesa' }, { k: 'income', label: 'Entrata' }, { k: 'transfer', label: 'Trasferimento' }]

function parseTags(s: string): string[] {
  return [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 20)
}

export function TxForm({ tx, onClose }: { tx?: Transaction; onClose: () => void }) {
  const { ledger, accounts, counterparties, tags, refresh } = useBook()
  const map = useMemo(() => byId(accounts), [accounts])
  const init = useMemo(() => (tx ? inferInput(tx, accounts) : null), [tx, accounts])
  const leaves = useMemo(() => postable(accounts), [accounts])
  const label = (a: Account) => accountPath(a, map)

  const firstOf = (f: (a: Account) => boolean) => leaves.find(f)?.id ?? 0
  const [kind, setKind] = useState<TxKind>(init?.kind ?? 'expense')
  const [amount, setAmount] = useState(init ? (init.amount_minor / 100).toFixed(2).replace('.', ',') : '')
  const [from, setFrom] = useState(init?.from_account_id ?? firstOf((a) => a.type === 'asset'))
  const [to, setTo] = useState(init?.to_account_id ?? firstOf((a) => a.type === 'expense'))
  const [date, setDate] = useState(init?.booked_on ?? today())
  const [desc, setDesc] = useState(init?.description ?? '')
  const [cpName, setCpName] = useState(() => counterparties.find((c) => c.id === init?.counterparty_id)?.name ?? '')
  const [tagText, setTagText] = useState(() => (init?.tag_ids ?? []).map((id) => tags.find((t) => t.id === id)?.name).filter(Boolean).join(', '))
  const [notes, setNotes] = useState(init?.notes ?? '')
  const [splitsOn, setSplitsOn] = useState((init?.splits.length ?? 0) > 0)
  const [splits, setSplits] = useState<{ account: number; amount: string }[]>(
    init?.splits.length ? init.splits.map((s) => ({ account: s.account_id, amount: (s.amount_minor / 100).toFixed(2).replace('.', ',') })) : [],
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const catType = kind === 'expense' ? 'expense' : kind === 'income' ? 'income' : null
  const fromOptions = leaves.filter((a) => (kind === 'income' ? a.type === 'income' : kind === 'opening' ? a.type === 'equity' || isMoney(a) : isMoney(a)))
  const toOptions = leaves.filter((a) => (kind === 'expense' ? a.type === 'expense' : kind === 'opening' ? a.type === 'equity' || isMoney(a) : isMoney(a)))
  const catOptions = leaves.filter((a) => a.type === catType)

  const changeKind = (k: TxKind) => {
    setKind(k)
    setSplitsOn(false)
    setSplits([])
    if (k === 'expense') { setFrom(firstOf((a) => a.type === 'asset')); setTo(firstOf((a) => a.type === 'expense')) }
    if (k === 'income') { setFrom(firstOf((a) => a.type === 'income')); setTo(firstOf((a) => a.type === 'asset')) }
    if (k === 'transfer') { setFrom(firstOf((a) => a.type === 'asset')); setTo(leaves.filter((a) => isMoney(a))[1]?.id ?? 0) }
  }

  const total = parseEur(amount)
  const splitSum = splits.reduce((s, r) => s + (parseEur(r.amount) ?? 0), 0)

  const startSplit = () => {
    const cat = kind === 'expense' ? to : from
    setSplitsOn(true)
    setSplits([{ account: cat || catOptions[0]?.id || 0, amount }, { account: catOptions.find((a) => a.id !== cat)?.id ?? 0, amount: '' }])
  }

  async function save(again: boolean) {
    setError('')
    if (total === null || total <= 0) return setError('Inserisci un importo valido, ad esempio 48,00.')
    if (!date) return setError('Inserisci la data.')
    if (splitsOn) {
      if (splits.length < 2 || splits.some((r) => !r.account || (parseEur(r.amount) ?? 0) <= 0)) return setError('Ogni ripartizione ha bisogno di una categoria e di un importo.')
      if (splitSum !== total) return setError(`La somma delle ripartizioni (${eur(splitSum)}) deve essere uguale all'importo (${eur(total)}).`)
    } else if (!from || !to) return setError('Scegli il conto di partenza e quello di arrivo.')
    if (!splitsOn && from === to) return setError('Il conto di partenza e quello di arrivo devono essere diversi.')

    setBusy(true)
    try {
      // controparte ed etichette: si usano quelle esistenti, le altre si creano
      let cpId: number | null = null
      const cpTrim = cpName.trim()
      if (cpTrim) {
        const found = counterparties.find((c) => c.name.toLowerCase() === cpTrim.toLowerCase())
        cpId = found ? found.id : (await post<Named>(`${L(ledger.id)}/counterparties`, { name: cpTrim, kind: 'other' })).id
      }
      const tagIds: number[] = []
      for (const name of parseTags(tagText)) {
        const found = tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
        tagIds.push(found ? found.id : (await post<Named>(`${L(ledger.id)}/tags`, { name })).id)
      }
      const body = {
        kind, booked_on: date, description: desc.trim(), counterparty_id: cpId, notes: notes.trim(), tag_ids: tagIds, amount_minor: total,
        from_account_id: splitsOn && kind === 'income' ? 0 : from, to_account_id: splitsOn && kind === 'expense' ? 0 : to,
        splits: splitsOn ? splits.map((r) => ({ account_id: r.account, amount_minor: parseEur(r.amount) ?? 0 })) : [],
      }
      if (tx) await put(`${L(ledger.id)}/transactions/${tx.id}`, body)
      else await post(`${L(ledger.id)}/transactions`, body)
      refresh()
      if (again && !tx) {
        setAmount(''); setDesc(''); setNotes(''); setTagText(''); setCpName(''); setSplitsOn(false); setSplits([])
      } else onClose()
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const sign = kind === 'expense' ? 'neg' : kind === 'income' ? 'pos' : ''
  const opts = (xs: Account[]) => <>{[<option key="0" value={0}>Scegli…</option>, ...xs.map((a) => <option key={a.id} value={a.id}>{label(a)}</option>)]}</>

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="pn drawer" role="dialog" aria-modal="true" aria-label={tx ? 'Modifica movimento' : 'Nuovo movimento'}>
        <div className="ph" style={{ padding: '16px 20px', fontSize: 14 }}>
          <span>{tx ? 'Modifica movimento' : 'Nuovo movimento'}</span>
          <button className="btn btn-s" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>
        <form className="body" onSubmit={(e) => { e.preventDefault(); void save(false) }}>
          {tx && !init ? (
            <div className="err">Questo movimento ha una struttura che non si può modificare da qui: usa lo storno.</div>
          ) : (
            <>
              {kind === 'opening' ? <span className="badge">Saldo iniziale</span> : (
                <div className="seg" role="tablist">
                  {KINDS.map((x) => <button type="button" key={x.k} className={kind === x.k ? 'on' : ''} onClick={() => changeKind(x.k)}>{x.label}</button>)}
                </div>
              )}
              <Field label="Importo">
                <input className={`inp amtbig ${sign}`} inputMode="decimal" autoFocus placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Importo in euro" />
              </Field>
              <div className="grid2">
                {!(splitsOn && kind === 'income') && (
                  <Field label={kind === 'income' ? 'Da (categoria)' : 'Da (conto)'}>
                    <select className="inp" value={from} onChange={(e) => setFrom(Number(e.target.value))}>{opts(fromOptions)}</select>
                  </Field>
                )}
                {!(splitsOn && kind === 'expense') && (
                  <Field label={kind === 'expense' ? 'Verso (categoria)' : 'Verso (conto)'}>
                    <select className="inp" value={to} onChange={(e) => setTo(Number(e.target.value))}>{opts(toOptions)}</select>
                  </Field>
                )}
              </div>
              {splitsOn && (
                <div className="fld">
                  <span className="lbl">Ripartizione tra categorie</span>
                  {splits.map((r, i) => (
                    <div key={i} className="row" style={{ flexWrap: 'nowrap', marginBottom: 6 }}>
                      <select className="inp" aria-label={`Categoria ${i + 1}`} value={r.account} onChange={(e) => setSplits(splits.map((x, j) => (j === i ? { ...x, account: Number(e.target.value) } : x)))}>{opts(catOptions)}</select>
                      <input className="inp" style={{ width: 120, textAlign: 'right' }} inputMode="decimal" aria-label={`Importo ${i + 1}`} value={r.amount} onChange={(e) => setSplits(splits.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                      {splits.length > 2 && <button type="button" className="btn btn-s" aria-label="Rimuovi" onClick={() => setSplits(splits.filter((_, j) => j !== i))}>✕</button>}
                    </div>
                  ))}
                  <div className="row">
                    <button type="button" className="btn btn-s" onClick={() => setSplits([...splits, { account: 0, amount: '' }])}>+ Categoria</button>
                    <button type="button" className="btn btn-s" onClick={() => { setSplitsOn(false); setSplits([]) }}>Non dividere</button>
                    <span className={splitSum === total ? 'mut' : 'neg'}>{eur(splitSum)} / {total !== null ? eur(total) : '—'}</span>
                  </div>
                </div>
              )}
              <div className="grid2">
                <Field label="Data"><input className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
                <Field label="Controparte">
                  <input className="inp" list="cp-list" placeholder="Facoltativa" value={cpName} onChange={(e) => setCpName(e.target.value)} maxLength={255} />
                  <datalist id="cp-list">{counterparties.map((c) => <option key={c.id} value={c.name} />)}</datalist>
                </Field>
              </div>
              <Field label="Descrizione"><input className="inp" value={desc} maxLength={500} onChange={(e) => setDesc(e.target.value)} /></Field>
              <Field label="Etichette (separate da virgola)"><input className="inp" list="tag-list" placeholder="cena, compleanno" value={tagText} onChange={(e) => setTagText(e.target.value)} />
                <datalist id="tag-list">{tags.map((t) => <option key={t.id} value={t.name} />)}</datalist></Field>
              {catType && !splitsOn && <button type="button" className="inp mut" style={{ borderStyle: 'dashed', textAlign: 'left' }} onClick={startSplit}>Dividi in più categorie (facoltativo) +</button>}
              <Field label="Note"><textarea className="inp" maxLength={2000} placeholder="Facoltative" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
              {error && <div className="err" role="alert">{error}</div>}
            </>
          )}
          <button type="submit" hidden />
        </form>
        <div className="foot">
          {!tx ? <button className="btn" disabled={busy} onClick={() => void save(true)}>Salva e nuovo</button> : <span />}
          <div className="row">
            <button className="btn" onClick={onClose}>Annulla</button>
            <button className="btn btn-p" disabled={busy || (!!tx && !init)} onClick={() => void save(false)}>{busy ? 'Salvo…' : 'Salva'}</button>
          </div>
        </div>
      </aside>
    </>
  )
}
