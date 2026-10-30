// Importi in centesimi interi (solo euro). Formato italiano: 1.234,56 €
const nf = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })

export function eur(minor: number): string {
  return `${nf.format(minor / 100)} €`
}

/** Con segno esplicito: +1.234,56 € / −1.234,56 € */
export function eurSigned(minor: number): string {
  if (minor === 0) return eur(0)
  return `${minor > 0 ? '+' : '−'}${nf.format(Math.abs(minor) / 100)} €`
}

/** Legge un importo scritto dall'utente ("1.234,56", "12,5", "12.50"). Restituisce centesimi o null. */
export function parseEur(input: string): number | null {
  let s = input.replace(/[€\s]/g, '')
  if (!s) return null
  if (s.includes(',')) {
    if (!/^\d{1,3}(\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/.test(s)) return null
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '') // 1.234 = mille duecentotrentaquattro
  } else if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    return null
  }
  const [i, d = ''] = s.split('.')
  const minor = Number(i) * 100 + Number(d.padEnd(2, '0'))
  return Number.isSafeInteger(minor) && minor <= 10_000_000_000_000 ? minor : null
}
