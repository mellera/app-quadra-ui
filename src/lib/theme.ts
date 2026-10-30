export type Theme = 'system' | 'light' | 'dark'
const KEY = 'quadra.theme'

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch { /* storage non disponibile */ }
  return 'system'
}

export function applyTheme(t: Theme) {
  const el = document.documentElement
  if (t === 'system') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', t)
  try {
    if (t === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, t)
  } catch { /* storage non disponibile */ }
}
