import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function Login() {
  const { status, error, login } = useAuth()
  const loc = useLocation()
  const returnTo = typeof loc.state === 'object' && loc.state && 'from' in loc.state ? String((loc.state as { from: string }).from) : '/'
  return (
    <div className="centerwrap">
      <div className="pn" style={{ width: 360, maxWidth: '100%' }}>
        <div className="brand">QUADRA<span>/</span>LEDGER</div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p>Finanza personale e condivisa, a partita doppia.</p>
          {error && <div className="err" role="alert">{error}</div>}
          <button className="btn btn-p" style={{ minHeight: 44 }} disabled={status === 'loading'} onClick={() => login(returnTo)}>Accedi</button>
          <p className="mut" style={{ fontSize: 12 }}>L'accesso passa dal servizio di identità: l'app non vede la tua password. Gli account si creano solo su invito.</p>
        </div>
      </div>
    </div>
  )
}

export function Callback() {
  const { finishLogin, status } = useAuth()
  const nav = useNavigate()
  useEffect(() => {
    let alive = true
    void finishLogin().then((to) => { if (alive) nav(to, { replace: true }) })
    return () => { alive = false }
    // l'effetto deve partire una sola volta: il codice di autorizzazione si usa una volta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <div className="centerwrap"><p className="mut" role="status">{status === 'error' ? 'Accesso non riuscito.' : 'Accesso in corso…'}</p></div>
}
