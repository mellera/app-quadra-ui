import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { useBook } from '../lib/book'
import { applyTheme, getTheme, type Theme } from '../lib/theme'
import { Page, Panel } from '../components/Common'

export function Profile() {
  const { user } = useBook()
  const { logout } = useAuth()
  const [theme, setTheme] = useState<Theme>(getTheme)
  const pick = (t: Theme) => { applyTheme(t); setTheme(t) }
  return (
    <Page title="Account">
      <Panel title="Utente"><p style={{ padding: 12 }}>{user.display_name || user.username} <span className="mut">@{user.username}</span></p></Panel>
      <Panel title="Tema">
        <div className="seg" style={{ margin: 12 }}>
          {(['system', 'light', 'dark'] as Theme[]).map((t) => <button key={t} className={theme === t ? 'on' : ''} onClick={() => pick(t)}>{{ system: 'Sistema', light: 'Chiaro', dark: 'Scuro' }[t]}</button>)}
        </div>
      </Panel>
      <button className="btn" onClick={logout}>Esci</button>
    </Page>
  )
}
