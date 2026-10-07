import { expect, test } from 'claude-code/testing'

import { frame, newCity, tick } from '../hooks/city'
import { cityFolderOf } from '../hooks/register'
import { clean, sanitizeCity, sanitizeLedger, sanitizeNeighbour } from '../hooks/safe'
import { weighTokens } from '../hooks/shop'
import { applyLedger, contest, emptyLedger, LEASE_MS } from '../hooks/sync'
import { entrancesOf, MAX_TUNNEL } from '../hooks/underground'

const hostile = {
  ...newCity(1),
  citizens: Number.NaN,
  tokens: 1e300,
  tunnel: 1e12,
  tunnel2: -5,
  owned: ['ring', 'not-an-item', 7],
  project: '\u001b]52;c;aGk=\u0007evil\r‮project',
  applied: { __proto__: { ledger: {} }, 'ok-1': { ledger: { tokens: -9, purchases: 'ring' }, at: 'soon' }, '../x': { ledger: {}, at: 1 } },
  buildings: [
    { id: 1, x: 0, w: 1e9, kind: 'tower', floors: 1e8, target: 1e10, hue: 0 },
    { id: 2, x: 'far', w: 5, kind: 'mystery', floors: 3, target: 3, hue: 9 },
    { id: 3, x: 9, w: 5, kind: 'special', special: 'nope', floors: 1, target: 1, hue: 0 },
    null,
    'house',
  ],
}

test('control characters, bidi marks and line breaks are stripped, and length capped', async () => {
  expect(clean('\u001b[31mred\u001b[0m\r\nline‮x​ ', 100)).toBe('[31mred[0mlinex')
  expect(clean('a'.repeat(500), 10)).toBe('aaaaaaaaaa')
  expect(clean({ toString: () => 'x' })).toBe('')
})

test('a hostile city is clamped into something cheap and safe to draw', async () => {
  const c = sanitizeCity(JSON.parse(JSON.stringify(hostile)))!
  expect(c.citizens).toBe(0)
  expect(c.tunnel).toBe(MAX_TUNNEL)
  expect(c.tunnel2).toBe(0)
  expect(c.owned).toEqual(['ring'])
  expect(c.project).toBe(']52;c;aGk=evilproject')
  expect(c.buildings.length).toBe(2)
  expect(c.buildings[0]).toMatchObject({ w: 24, floors: 14, target: 14 })
  expect(c.buildings[1]).toMatchObject({ kind: 'house', x: 0, hue: 2 })
  expect(Object.keys(c.applied ?? {})).toEqual(['ok-1'])
  expect(c.applied?.['ok-1']?.ledger).toMatchObject({ tokens: 0, purchases: [] })
  expect(Object.getPrototypeOf(c.applied)).toBe(Object.prototype)

  const started = Date.now()
  frame(c, 240, 60, Date.UTC(2026, 9, 8, 12))
  tick(c, 0)
  expect(entrancesOf({ ...c, tunnel: 1e12 }).length).toBeLessThan(40)
  expect(Date.now() - started).toBeLessThan(500)
})

test('anything that is not a city, ledger or presence is rejected', async () => {
  for (const junk of [null, 1, 'x', [], {}, { buildings: 'no' }]) expect(sanitizeCity(junk)).toBeUndefined()
  expect(sanitizeLedger(1)).toBeUndefined()
  expect(sanitizeLedger({})).toEqual(emptyLedger())
  expect(sanitizeNeighbour({ id: 'a' })).toBeUndefined()
})

test('presence keeps only what the game draws: no paths, no task descriptions', async () => {
  const n = sanitizeNeighbour({
    id: 'abc',
    slug: 'Users-me-proj--1a2b3c',
    project: 'proj\u001b[2J',
    cwd: '/Users/me/secret-client/proj',
    isBusy: 'yes',
    tier: 'Town',
    skyline: [3, 1e9, 'x'],
    agents: [{ id: 'z', type: 'Explore', description: 'rotate the API key sk-123', status: 'running' }, { type: 'x', status: 'evil' }],
  })!
  expect(n).toEqual({ id: 'abc', slug: 'Users-me-proj--1a2b3c', project: 'proj[2J', isBusy: false, tier: 'Town', skyline: [3, 14, 0], agents: [{ type: 'Explore', status: 'running' }] })
  expect(JSON.stringify(n)).not.toContain('secret-client')
  expect(JSON.stringify(n)).not.toContain('sk-123')
})

test('earnings never run backwards, and a forged lease cannot hold the city forever', async () => {
  const c = applyLedger(newCity(1), 's', { ...emptyLedger(), tokens: 500 }, 0)
  expect(applyLedger(c, 's', { ...emptyLedger(), tokens: 100 }, 0).tokens).toBe(500)
  const honest = { id: 'other', until: LEASE_MS }
  expect(contest(honest, 'me', 0).write).toBeUndefined()
  expect(contest({ id: 'squatter', until: 1e300 }, 'me', 0).write?.id).toBe('me')
})

test('missing usage fields count as zero, never NaN', async () => {
  expect(weighTokens({ output_tokens: 10 })).toBe(10)
  expect(weighTokens({ input_tokens: Number.NaN, cache_read_input_tokens: 100 })).toBe(10)
})

test('paths that differ only in punctuation get separate cities', async () => {
  expect(cityFolderOf('/a-b/c')).not.toBe(cityFolderOf('/a/b-c'))
  expect(cityFolderOf('/Users/me/projects/mini-crossword')).toMatch(/^Users-me-projects-mini-crossword--[0-9a-f]{6}$/)
})
