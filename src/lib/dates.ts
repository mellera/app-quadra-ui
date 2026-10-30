export const pad = (n: number) => String(n).padStart(2, '0')

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const today = () => isoDate(new Date())

/** AAAA-MM-GG → GG/MM/AAAA */
export function showDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/** Primo e ultimo giorno del mese di una data ISO (o di oggi). */
export function monthRange(iso = today()): { from: string; to: string } {
  const [y, m] = iso.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` }
}

export function addMonths(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return isoDate(d)
}

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
export const monthName = (iso: string) => `${MESI[Number(iso.split('-')[1]) - 1]} ${iso.split('-')[0]}`
export const monthShort = (iso: string) => MESI[Number(iso.split('-')[1]) - 1].slice(0, 3)
