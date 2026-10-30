import { describe, expect, it } from 'vitest'
import { isStandalone } from './pwa'

describe('isStandalone', () => {
  it('è false senza window (ambiente node)', () => {
    expect(typeof window === 'undefined' ? false : isStandalone()).toBe(false)
  })
})
