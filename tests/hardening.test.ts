import { expect, test } from 'claude-code/testing'

import type { City } from '../types'
import { newCity } from '../hooks/city'
import { findItem, logLines } from '../hooks/register'
import { clean, MAX_SESSIONS, sanitizeCity } from '../hooks/safe'
import { buy, MAX_BUILDINGS } from '../hooks/shop'
import { applyLedger, emptyLedger } from '../hooks/sync'

test('past the session cap, earnings are not counted again every round', async () => {
  let c: City = newCity(1)
  const ledgers = Array.from({ length: MAX_SESSIONS + 5 }, (_, i) => [`s${i}`, { ...emptyLedger(), bricks: 10 }] as const)
  const start = c.bricks
  for (let round = 1; round <= 5; round++) {
    for (const [session, l] of ledgers) {
      const isFull = Object.keys(c.applied ?? {}).length >= MAX_SESSIONS
      if (!(isFull && !c.applied?.[session])) c = applyLedger(c, session, l, round * 2000)
    }
    c = sanitizeCity(JSON.parse(JSON.stringify(c)))!
  }
  expect(c.bricks - start).toBe(MAX_SESSIONS * 10)
  expect(Object.keys(c.applied ?? {}).length).toBe(MAX_SESSIONS)
})

test('the cap keeps the most recently active sessions', async () => {
  const total = MAX_SESSIONS + 50
  const applied = Object.fromEntries(Array.from({ length: total }, (_, i) => [`s${i}`, { ledger: emptyLedger(), at: i }]))
  const kept = Object.keys(sanitizeCity({ ...newCity(1), applied })!.applied ?? {})
  expect(kept.length).toBe(MAX_SESSIONS)
  expect(kept).toContain(`s${total - 1}`)
  expect(kept).not.toContain('s0')
})

test('a stale copy of a ledger read late is never paid out twice', async () => {
  const newer = { ...emptyLedger(), tokens: 900, purchases: ['trees' as const] }
  const older = { ...emptyLedger(), tokens: 500 }
  let c = applyLedger({ ...newCity(1), tokens: 1_000_000 }, 's', newer, 1)
  c = applyLedger(c, 's', older, 2)
  c = applyLedger(c, 's', newer, 3)
  expect(c.tokens).toBe(1_000_900)
  expect(c.owned).toEqual(['trees'])
})

test('cleaning keeps emoji, flags and joined scripts, and never cuts a character in half', async () => {
  const family = '👨‍👩‍👧'
  const england = '🏴󠁧󠁢󠁥󠁮󠁧󠁿'
  const persian = 'می‌خواهم'
  expect(clean(family)).toBe(family)
  expect(clean(england)).toBe(england)
  expect(clean(persian)).toBe(persian)
  expect(clean('ab‮cd​ef⁦gh')).toBe('abcdefgh')
  const cut = clean('a'.repeat(47) + '😀😀', 48)
  expect(cut).toBe('a'.repeat(47) + '😀')
  expect(clean('word     next', 5)).toBe('word')
  expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(clean('x'.repeat(10) + '😀'.repeat(10), 12))).toBe(false)
})

test('a full city refuses another landmark rather than losing a building', async () => {
  const full = { ...newCity(1), tokens: 1e12, buildings: Array.from({ length: MAX_BUILDINGS }, (_, i) => ({ id: i + 1, x: i, w: 1, kind: 'park' as const, floors: 0, target: 0, hue: 0 })) }
  expect(buy(full, 'stadium').error).toContain('no room')
  expect(buy(full, 'trees').city).toBeDefined()
})

test('/city buy needs an exact name or a unique prefix of three letters', async () => {
  expect(findItem('e')).toBeUndefined()
  expect(findItem('st')).toBeUndefined()
  expect(findItem('sta')).toBeUndefined()
  expect(findItem('stad')?.id).toBe('stadium')
  expect(findItem('ferris wheel')?.id).toBe('ferris')
  expect(findItem('rocket')?.id).toBe('rocket')
  expect(findItem('')).toBeUndefined()
})

test('log lines kept from older code are cleaned before they are drawn', async () => {
  expect(logLines([{ at: 'x', text: '\u001b[2Jhi\r' }, null, { at: 5, text: 42 }, { at: 6, text: 'ok' }])).toEqual([
    { at: 0, text: '[2Jhi' },
    { at: 6, text: 'ok' },
  ])
})
