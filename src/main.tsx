import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
import './styles/ledger.css'
import { App } from './App'
import { registerServiceWorker } from './lib/pwa'
import { applyTheme, getTheme } from './lib/theme'

applyTheme(getTheme())
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

registerServiceWorker()
