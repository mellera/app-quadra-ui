export type Role = 'owner' | 'editor' | 'viewer'
export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'
export type TxKind = 'expense' | 'income' | 'transfer' | 'opening'

export interface User { id: number; username: string; display_name: string }
export interface Ledger { id: number; name: string; kind: 'personal' | 'shared'; role: Role }
export interface Member { user_id: number; username: string; display_name: string; role: Role }
export interface Account {
  id: number; parent_id: number | null; name: string; type: AccountType
  is_group: boolean; is_active: boolean; member_user_id: number | null
  opened_on: string | null; closed_on: string | null
}
export interface Posting { id?: number; account_id: number; amount_minor: number; memo?: string; reconciliation_id?: number | null }
export interface Transaction {
  id: number; booked_on: string; description: string; counterparty_id: number | null; notes?: string
  created_by: number; reverses_id: number | null; reversed_by: number | null; tag_ids: number[]; postings: Posting[]
}
export interface Split { account_id: number; amount_minor: number; memo?: string }
export interface TxInput {
  kind: TxKind; booked_on: string; description: string; counterparty_id: number | null; notes: string
  tag_ids: number[]; amount_minor: number; from_account_id: number; to_account_id: number; splits: Split[]
}
export interface Named { id: number; name: string; kind?: string }
export interface Balance { account_id: number; amount_minor: number }
export interface BudgetPeriod { id: number; name: string; start_on: string; end_on: string }
export interface BudgetItem {
  id: number; kind: 'budget' | 'target'; name: string; amount_minor: number; account_ids: number[]
  actual_minor: number; remaining_minor: number; state: 'ok' | 'warning' | 'over' | 'in_progress' | 'reached'
}
export interface BudgetPeriodView extends BudgetPeriod { items: BudgetItem[] }
export interface Candidate { posting_id: number; transaction_id: number; booked_on: string; description: string; amount_minor: number; ticked: boolean }
export interface ReconciliationView {
  id: number; account_id: number; statement_date: string; statement_balance_minor: number; closed: boolean
  calculated_minor: number; difference_minor: number; candidates: Candidate[]
}
