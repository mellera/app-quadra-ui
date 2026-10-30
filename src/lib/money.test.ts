import { describe, expect, it } from 'vitest'
import { eur, eurSigned, parseEur } from './money'

describe('money', () => {
  it('formatta in italiano', () => {
    expect(eur(123456).replace(/\s/g, ' ')).toBe('1.234,56 €')
    expect(eur(0)).toBe('0,00 €')
    expect(eurSigned(-6240)).toBe('−62,40 €')
    expect(eurSigned(285000)).toBe('+2.850,00 €')
  })
  it('legge gli importi', () => {
    expect(parseEur('1.234,56')).toBe(123456)
    expect(parseEur('12,5')).toBe(1250)
    expect(parseEur('12.50')).toBe(1250)
    expect(parseEur('1.234')).toBe(123400)
    expect(parseEur('48')).toBe(4800)
    expect(parseEur(' 62,40 € ')).toBe(6240)
  })
  it('rifiuta il resto', () => {
    for (const s of ['', 'abc', '1,234', '1,2,3', '-5', '12,345', '1.23.4', '99999999999999999']) expect(parseEur(s), s).toBeNull()
  })
})
