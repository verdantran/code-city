import { expect, test } from 'claude-code/testing'

import { newCity } from '../hooks/city'
import { clean, isOurFile, sanitizeLedger, sanitizeNeighbour, stamp } from '../hooks/safe'
import { emptyLedger, pruneApplied } from '../hooks/sync'

test('only files carrying our stamp, or our exact older fields, may be overwritten', async () => {
  expect(isOurFile('ledger', JSON.parse(stamp('ledger', emptyLedger())))).toBe(true)
  expect(isOurFile('presence', JSON.parse(stamp('presence', {})))).toBe(true)
  expect(isOurFile('city', JSON.parse(stamp('city', newCity(1))))).toBe(true)
  expect(isOurFile('lease', JSON.parse(stamp('lease', { id: 'a', until: 1 })))).toBe(true)

  expect(isOurFile('presence', JSON.parse(stamp('ledger', emptyLedger())))).toBe(false)
  expect(isOurFile('ledger', { permissions: {} })).toBe(false)
  expect(isOurFile('ledger', { tokens: 1, editor: 'vim' })).toBe(false)
  expect(isOurFile('presence', {})).toBe(false)
  expect(isOurFile('city', { name: 'x' })).toBe(false)
  expect(isOurFile('lease', 'id')).toBe(false)

  expect(isOurFile('ledger', emptyLedger())).toBe(true)
  expect(isOurFile('presence', { id: 'a', project: 'p', cwd: '/x', isBusy: false, tier: 'Town', skyline: [], agents: [] })).toBe(true)
  expect(isOurFile('city', newCity(1))).toBe(true)
  expect(isOurFile('lease', { id: 'a', until: 5 })).toBe(true)
})

test('stamped files still read back as the data inside them', async () => {
  expect(sanitizeLedger(JSON.parse(stamp('ledger', { ...emptyLedger(), tokens: 7 })))?.tokens).toBe(7)
  expect(sanitizeNeighbour(JSON.parse(stamp('presence', {})))).toBeUndefined()
})

test('a session dated in the future cannot hold a slot', async () => {
  const now = 1_000_000_000
  const c = { ...newCity(1), applied: { real: { ledger: emptyLedger(), at: now - 1000 }, ahead: { ledger: emptyLedger(), at: 1e15 } } }
  expect(Object.keys(pruneApplied(c, now).applied ?? {})).toEqual(['real'])
})

test('cleaning drops lone surrogate halves, piles of accents, stray tags and invisible fillers', async () => {
  expect(clean('ok\uD83D')).toBe('ok')
  expect(clean('e' + '́'.repeat(400) + 'x')).toBe('e' + '́'.repeat(4) + 'x')
  const england = '🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}'
  expect(clean(england)).toBe(england)
  expect(clean('hi\u{E0068}\u{E0069}dden')).toBe('hidden')
  expect(clean('ㅤᅟ⠀nameﾠ')).toBe('name')
  expect(clean('a' + '́'.repeat(382) + '😀', 48)).not.toMatch(/[\uD800-\uDBFF]$/)
})
