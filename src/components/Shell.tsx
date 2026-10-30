import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useBook } from '../lib/book'
import { useIsDesktop } from '../lib/hooks'
import type { Transaction } from '../lib/types'
import { UiContext } from './ui-context'
import { TxForm } from './TxForm'

const ROLE: Record<string, string> = { owner: 'proprietario', editor: 'modifica', viewer: 'consultazione' }

export function Shell() {
  const desktop = useIsDesktop()
  const { logout } = useAuth()
  const { user, ledgers, ledger, setLedger, canWrite } = useBook()
  const [editor, setEditor] = useState<{ tx?: Transaction } | null>(null)
  const openTx = (tx?: Transaction) => { if (canWrite) setEditor({ tx }) }

  return (
    <UiContext.Provider value={{ openTx }}>
      <div className="app" style={desktop ? undefined : { flexDirection: 'column' }}>
        {desktop && (
          <aside className="side">
            <div className="brand">QUADRA<span>/</span>LEDGER</div>
            <label className="bookpick">
              <select className="inp" style={{ border: 0, padding: 0, minHeight: 0, background: 'transparent' }} aria-label="Libro attivo"
                value={ledger.id} onChange={(e) => setLedger(Number(e.target.value))}>
                {ledgers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <small>Libro · {ROLE[ledger.role]}</small>
            </label>
            <nav className="nav" aria-label="Principale">
              <NavLink to="/" end>Home</NavLink>
              <NavLink to="/movimenti">Movimenti</NavLink>
              <NavLink to="/conti">Conti</NavLink>
              <NavLink to="/budget">Budget e target</NavLink>
              <NavLink to="/report">Report</NavLink>
              <div className="sep" />
              <NavLink to="/libro">Libro</NavLink>
              <NavLink to="/account">Account</NavLink>
            </nav>
            <div className="userbox">{user.username}<br /><button onClick={logout}>Esci</button></div>
          </aside>
        )}
        <div className="main" style={desktop ? undefined : { flex: 1, minHeight: 0 }}>
          <Outlet />
        </div>
        {!desktop && (
          <nav className="tabbar" aria-label="Principale">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/movimenti">Movimenti</NavLink>
            {canWrite ? <a className="plus" href="#nuovo" aria-label="Nuovo movimento" onClick={(e) => { e.preventDefault(); openTx() }}><span>+</span></a> : <NavLink to="/libro">Libro</NavLink>}
            <NavLink to="/conti">Conti</NavLink>
            <NavLink to="/budget">Budget</NavLink>
          </nav>
        )}
      </div>
      {editor && <TxForm tx={editor.tx} onClose={() => setEditor(null)} />}
    </UiContext.Provider>
  )
}
