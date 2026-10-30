import { useState } from 'react'
import { del, get, patch, post, L } from '../lib/api'
import { useBook } from '../lib/book'
import { errText, useAsync } from '../lib/hooks'
import type { Ledger, Member, Role } from '../lib/types'
import { ErrorBox, Field, Loading, Page, Panel } from '../components/Common'

const ROLE: Record<Role, string> = { owner: 'Proprietario', editor: 'Modifica', viewer: 'Consultazione' }

export function Book() {
  const { ledger, ledgers, user, version, refresh, refreshLedgers, setLedger } = useBook()
  const owner = ledger.role === 'owner'
  const shared = ledger.kind === 'shared'
  const q = useAsync(() => get<Member[]>(`${L(ledger.id)}/members`), [ledger.id, version])
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<Role>('editor')
  const [newName, setNewName] = useState('')
  const [err, setErr] = useState('')

  async function act(f: () => Promise<unknown>, after?: () => void) {
    setErr('')
    try { await f(); refresh(); after?.() } catch (e) { setErr(errText(e)) }
  }

  return (
    <Page title="Libro" sub={ledger.name}>
      {err && <ErrorBox message={err} />}
      <Panel title="Membri" note={shared ? undefined : 'libro personale'} flush>
        {q.loading && !q.data ? <Loading /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> : (
          <table className="tbl"><tbody>{(q.data ?? []).map((m) => (
            <tr key={m.user_id}>
              <td>{m.display_name || m.username} <small className="mut">@{m.username}</small></td>
              <td>{owner && shared && m.user_id !== user.id ? (
                <select className="inp" aria-label={`Ruolo di ${m.username}`} value={m.role} onChange={(e) => void act(() => patch(`${L(ledger.id)}/members/${m.user_id}`, { role: e.target.value }))}>
                  {(['owner', 'editor', 'viewer'] as Role[]).map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}
                </select>) : ROLE[m.role]}</td>
              <td className="r">{owner && shared && m.user_id !== user.id && <button className="btn btn-s" onClick={() => { if (confirm(`Rimuovere ${m.username}?`)) void act(() => del(`${L(ledger.id)}/members/${m.user_id}`)) }}>Rimuovi</button>}</td>
            </tr>))}</tbody></table>
        )}
      </Panel>
      {owner && shared && (
        <Panel title="Aggiungi membro">
          <div className="row" style={{ padding: 12, alignItems: 'flex-end' }}>
            <Field label="Nome utente"><input className="inp" maxLength={64} value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
            <Field label="Ruolo"><select className="inp" value={role} onChange={(e) => setRole(e.target.value as Role)}><option value="editor">Modifica</option><option value="viewer">Consultazione</option><option value="owner">Proprietario</option></select></Field>
            <button className="btn btn-p" disabled={!username.trim()} onClick={() => void act(() => post(`${L(ledger.id)}/members`, { username: username.trim(), role }), () => setUsername(''))}>Aggiungi</button>
          </div>
          <p className="mut" style={{ padding: '0 12px 12px', fontSize: 12 }}>La persona deve aver già effettuato almeno un accesso a Quadra.</p>
        </Panel>
      )}
      <Panel title="Nuovo libro condiviso">
        <div className="row" style={{ padding: 12, alignItems: 'flex-end' }}>
          <Field label="Nome"><input className="inp" maxLength={120} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Es. Casa" /></Field>
          <button className="btn btn-p" disabled={!newName.trim()} onClick={() => void act(async () => { const l = await post<Ledger>('/v1/ledgers', { name: newName.trim() }); refreshLedgers(); setLedger(l.id) }, () => setNewName(''))}>Crea</button>
        </div>
        <p className="mut" style={{ padding: '0 12px 12px', fontSize: 12 }}>Hai {ledgers.length} {ledgers.length === 1 ? 'libro' : 'libri'}.</p>
      </Panel>
    </Page>
  )
}
