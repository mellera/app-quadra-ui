import type { Account, AccountType, Balance, Transaction, TxInput } from './types'

export const TYPE_LABEL: Record<AccountType, string> = {
  asset: 'Attività', liability: 'Passività', equity: 'Patrimonio netto', income: 'Entrate', expense: 'Spese',
}

export function byId(list: Account[]): Map<number, Account> {
  return new Map(list.map((a) => [a.id, a]))
}

/** Nome con il percorso: "Spese › Casa" (le radici di gruppo non si ripetono come prefisso inutile). */
export function accountPath(a: Account, map: Map<number, Account>): string {
  const parts = [a.name]
  let p = a.parent_id ? map.get(a.parent_id) : undefined
  let guard = 0
  while (p && guard++ < 10) {
    parts.unshift(p.name)
    p = p.parent_id ? map.get(p.parent_id) : undefined
  }
  return parts.join(' › ')
}

export const isMoney = (a: Account) => a.type === 'asset' || a.type === 'liability'

/** Conti utilizzabili in un movimento: foglie attive. */
export const postable = (list: Account[]) => list.filter((a) => !a.is_group && a.is_active)

export function balanceMap(bs: Balance[]): Map<number, number> {
  return new Map(bs.map((b) => [b.account_id, b.amount_minor]))
}

/** Patrimonio netto: somma dare-avere di attività e passività (le passività sono in avere, quindi negative). */
export function netWorth(accounts: Account[], bs: Balance[]): number {
  const m = balanceMap(bs)
  return accounts.filter(isMoney).reduce((s, a) => s + (m.get(a.id) ?? 0), 0)
}

/** Ricostruisce il movimento "da / verso" a partire dalle righe (per la modifica e per la descrizione). */
export function inferInput(tx: Transaction, accounts: Account[]): TxInput | null {
  const map = byId(accounts)
  const lines = tx.postings.map((p) => ({ ...p, acc: map.get(p.account_id) }))
  if (lines.some((l) => !l.acc)) return null
  const base = {
    booked_on: tx.booked_on, description: tx.description, counterparty_id: tx.counterparty_id, notes: tx.notes ?? '', tag_ids: tx.tag_ids,
  }
  const sum = (xs: typeof lines) => xs.reduce((s, l) => s + Math.abs(l.amount_minor), 0)
  const cats = lines.filter((l) => l.acc!.type === 'expense')
  const incs = lines.filter((l) => l.acc!.type === 'income')
  if (cats.length > 0 && incs.length === 0) {
    const from = lines.filter((l) => isMoney(l.acc!))
    if (from.length !== 1) return null
    const amount = sum(cats)
    return { ...base, kind: 'expense', amount_minor: amount, from_account_id: from[0].account_id,
      to_account_id: cats[0].account_id, splits: cats.length > 1 ? cats.map((l) => ({ account_id: l.account_id, amount_minor: l.amount_minor, memo: l.memo })) : [] }
  }
  if (incs.length > 0 && cats.length === 0) {
    const to = lines.filter((l) => isMoney(l.acc!))
    if (to.length !== 1) return null
    return { ...base, kind: 'income', amount_minor: sum(incs), from_account_id: incs[0].account_id, to_account_id: to[0].account_id,
      splits: incs.length > 1 ? incs.map((l) => ({ account_id: l.account_id, amount_minor: -l.amount_minor, memo: l.memo })) : [] }
  }
  if (lines.length === 2 && cats.length === 0 && incs.length === 0) {
    const from = lines.find((l) => l.amount_minor < 0)
    const to = lines.find((l) => l.amount_minor > 0)
    if (!from || !to) return null
    const opening = from.acc!.type === 'equity' || to.acc!.type === 'equity'
    return { ...base, kind: opening ? 'opening' : 'transfer', amount_minor: to.amount_minor, from_account_id: from.account_id, to_account_id: to.account_id, splits: [] }
  }
  return null
}

/** Riassunto di un movimento per le liste: categoria e conto. */
export function describe(tx: Transaction, accounts: Account[]): { category: string; account: string; amount: number; kind: string } {
  const map = byId(accounts)
  const inf = inferInput(tx, accounts)
  const name = (id?: number) => (id ? map.get(id)?.name ?? '?' : '?')
  if (!inf) return { category: 'Movimento composto', account: '', amount: 0, kind: 'other' }
  if (inf.kind === 'expense') return { category: inf.splits.length ? 'Ripartito' : name(inf.to_account_id), account: name(inf.from_account_id), amount: -inf.amount_minor, kind: 'expense' }
  if (inf.kind === 'income') return { category: inf.splits.length ? 'Ripartito' : name(inf.from_account_id), account: name(inf.to_account_id), amount: inf.amount_minor, kind: 'income' }
  return { category: inf.kind === 'opening' ? 'Saldo iniziale' : 'Trasferimento', account: `${name(inf.from_account_id)} → ${name(inf.to_account_id)}`, amount: inf.amount_minor, kind: inf.kind }
}
