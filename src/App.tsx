import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { BookProvider } from './lib/book'
import { Callback, Login } from './pages/Login'
import { Shell } from './components/Shell'
import { Home } from './pages/Home'
import { Transactions } from './pages/Transactions'
import { TransactionDetail } from './pages/TransactionDetail'
import { Accounts } from './pages/Accounts'
import { AccountDetail } from './pages/AccountDetail'
import { Reconcile } from './pages/Reconcile'
import { Budget } from './pages/Budget'
import { Report } from './pages/Report'
import { Book } from './pages/Book'
import { Profile } from './pages/Profile'
import { NotFound } from './pages/NotFound'
import { useUpdateAvailable } from './lib/pwa'

function Gate() {
  const { status } = useAuth()
  if (status === 'loading') return <div className="centerwrap"><p className="mut" role="status">Caricamento…</p></div>
  if (status !== 'authenticated') return <Login />
  return (
    <BookProvider fallback={(msg, loading) => <div className="centerwrap"><p className={loading ? 'mut' : 'err'} role={loading ? 'status' : 'alert'}>{msg}</p></div>}>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="movimenti" element={<Transactions />} />
          <Route path="movimenti/:id" element={<TransactionDetail />} />
          <Route path="conti" element={<Accounts />} />
          <Route path="conti/:id" element={<AccountDetail />} />
          <Route path="conti/:id/riconcilia" element={<Reconcile />} />
          <Route path="budget" element={<Budget />} />
          <Route path="report" element={<Report />} />
          <Route path="libro" element={<Book />} />
          <Route path="account" element={<Profile />} />
          <Route path="auth/callback" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BookProvider>
  )
}

function UpdateBanner() {
  const { available, update } = useUpdateAvailable()
  if (!available) return null
  return (
    <div role="status" style={{ position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 50, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--rule-strong)' }}>
      <span>Nuova versione disponibile</span>
      <button className="btn btn-p" onClick={update}>Aggiorna</button>
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <UpdateBanner />
      <AuthProvider>
        <Routes>
          <Route path="/auth/callback" element={<Callback />} />
          <Route path="*" element={<Gate />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
