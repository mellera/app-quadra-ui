import { describe, expect, it } from 'vitest'
import { describe as desc, inferInput, netWorth } from './ledger'
import type { Account, Transaction } from './types'

const A = (id: number, name: string, type: Account['type'], extra: Partial<Account> = {}): Account =>
  ({ id, parent_id: null, name, type, is_group: false, is_active: true, member_user_id: null, opened_on: null, closed_on: null, ...extra })
const accts = [A(1, 'Conto', 'asset'), A(2, 'Casa', 'expense'), A(3, 'Cibo', 'expense'), A(4, 'Stipendio', 'income'), A(5, 'Saldi', 'equity'), A(6, 'Carta', 'liability'), A(7, 'Cassa', 'asset')]
const T = (postings: Transaction['postings']): Transaction =>
  ({ id: 1, booked_on: '2026-10-29', description: 'x', counterparty_id: null, created_by: 1, reverses_id: null, reversed_by: null, tag_ids: [], postings })

describe('inferInput', () => {
  it('spesa', () => {
    const i = inferInput(T([{ account_id: 1, amount_minor: -500 }, { account_id: 2, amount_minor: 500 }]), accts)!
    expect(i).toMatchObject({ kind: 'expense', amount_minor: 500, from_account_id: 1, to_account_id: 2, splits: [] })
  })
  it('spesa ripartita', () => {
    const i = inferInput(T([{ account_id: 1, amount_minor: -1000 }, { account_id: 2, amount_minor: 600 }, { account_id: 3, amount_minor: 400 }]), accts)!
    expect(i.kind).toBe('expense')
    expect(i.amount_minor).toBe(1000)
    expect(i.splits.map((s) => s.amount_minor)).toEqual([600, 400])
  })
  it('entrata, trasferimento e saldo iniziale', () => {
    expect(inferInput(T([{ account_id: 4, amount_minor: -900 }, { account_id: 1, amount_minor: 900 }]), accts)).toMatchObject({ kind: 'income', from_account_id: 4, to_account_id: 1 })
    expect(inferInput(T([{ account_id: 1, amount_minor: -50 }, { account_id: 7, amount_minor: 50 }]), accts)).toMatchObject({ kind: 'transfer', from_account_id: 1, to_account_id: 7 })
    expect(inferInput(T([{ account_id: 5, amount_minor: -50 }, { account_id: 1, amount_minor: 50 }]), accts)).toMatchObject({ kind: 'opening' })
  })
  it('movimenti non riconducibili restano non modificabili', () => {
    expect(inferInput(T([{ account_id: 1, amount_minor: -5 }, { account_id: 2, amount_minor: 2 }, { account_id: 7, amount_minor: 3 }]), accts)).toBeNull()
    expect(inferInput(T([{ account_id: 99, amount_minor: -5 }, { account_id: 2, amount_minor: 5 }]), accts)).toBeNull()
  })
  it('descrizione per le liste', () => {
    expect(desc(T([{ account_id: 1, amount_minor: -500 }, { account_id: 2, amount_minor: 500 }]), accts)).toMatchObject({ category: 'Casa', account: 'Conto', amount: -500 })
  })
})

describe('netWorth', () => {
  it('somma attività e passività, ignora il resto', () => {
    const bs = [{ account_id: 1, amount_minor: 10000 }, { account_id: 6, amount_minor: -2500 }, { account_id: 2, amount_minor: 700 }]
    expect(netWorth(accts, bs)).toBe(7500)
  })
})
