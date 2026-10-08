import { expect, test } from 'claude-code/testing'

import type { City } from '../types'

import { newCity, tick } from '../hooks/city'
import { applyLedger, contest, emptyLedger, LEASE_MS, pruneApplied } from '../hooks/sync'
import { sanitizeLedger } from '../hooks/safe'

test('folding a ledger twice counts it once', async () => {
  const c = newCity(1)
  const l = { ...emptyLedger(), tokens: 5000, bricks: 20, citizens: 2 }
  const once = applyLedger(c, 'a', l, 0)
  const twice = applyLedger(once, 'a', l, 0)
  expect(twice.tokens).toBe(5000)
  expect(twice.bricks).toBe(c.bricks + 20)
  const more = applyLedger(twice, 'a', { ...l, tokens: 8000 }, 0)
  expect(more.tokens).toBe(8000)
})

test('two sessions earning at once both count, while the mayor keeps building', async () => {
  let shared = newCity(1)
  let a = emptyLedger()
  let b = emptyLedger()
  for (let t = 0; t < 50; t++) {
    a = { ...a, tokens: a.tokens + 1000, bricks: a.bricks + 3 }
    if (t % 2) b = { ...b, tokens: b.tokens + 500, citizens: b.citizens + 1 }
    shared = tick(applyLedger(applyLedger(shared, 'a', a, t), 'b', b, t), t * 2000)
  }
  expect(shared.tokens).toBe(50 * 1000 + 25 * 500)
  expect(shared.citizens).toBe(newCity(1).citizens + 25)
  expect(shared.buildings.length).toBeGreaterThan(1)
})

test('a purchase lands once, and the same item bought in two sessions is only paid for once', async () => {
  let shared: City = { ...newCity(1), tokens: 1_000_000 }
  const a = { ...emptyLedger(), purchases: ['trees' as const] }
  const b = { ...emptyLedger(), purchases: ['trees' as const, 'lamps' as const] }
  shared = applyLedger(shared, 'a', a, 0)
  shared = applyLedger(shared, 'a', a, 0)
  shared = applyLedger(shared, 'b', b, 0)
  expect(shared.owned).toEqual(['trees', 'lamps'])
  expect(shared.spent).toBe(150_000 + 250_000)
})

test('a later moment wins for fireworks and rainbows', async () => {
  const shared = applyLedger({ ...newCity(1), fireworksUntil: 9000 }, 'a', { ...emptyLedger(), fireworksUntil: 5000, rainbowUntil: 7000 }, 0)
  expect(shared.fireworksUntil).toBe(9000)
  expect(shared.rainbowUntil).toBe(7000)
})

test('one mayor at a time, confirmed before acting, with handover when the lease lapses', async () => {
  const first = contest(undefined, 'a', 0)
  expect(first.write?.id).toBe('a')
  expect(first.isMayor).toBe(false)
  expect(contest(first.write, 'a', 2000).isMayor).toBe(true)
  const rival = contest(first.write, 'b', 2000)
  expect(rival.write).toBeUndefined()
  expect(rival.isMayor).toBe(false)
  const lapsed = contest(first.write, 'b', LEASE_MS + 1)
  expect(lapsed.write?.id).toBe('b')
  expect(contest(lapsed.write, 'b', LEASE_MS + 2000).isMayor).toBe(true)
})

test('old sessions are forgotten after a week', async () => {
  const c = applyLedger(applyLedger(newCity(1), 'old', emptyLedger(), 0), 'new', emptyLedger(), 8 * 86_400_000)
  expect(Object.keys(pruneApplied(c, 8 * 86_400_000).applied ?? {})).toEqual(['new'])
})

test('buying again after a purchase the city could not afford still goes through', async () => {
  const poor = { ...newCity(1), tokens: 100_000 }
  // The session thought it could afford trees, but the city it was applied to could not.
  const first = { ...emptyLedger(), purchases: ['trees' as const] }
  const failed = applyLedger(poor, 's1', first, 1)
  expect(failed.owned ?? []).not.toContain('trees')
  // Tokens came in and the person pressed the same item again; the ledger crosses the disk on its way to the mayor.
  const again = sanitizeLedger({ ...first, tokens: 200_000, purchases: ['trees', 'trees'] })!
  const bought = applyLedger(failed, 's1', again, 2)
  expect(bought.owned).toContain('trees')
})
