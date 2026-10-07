import { expect, test } from 'claude-code/testing'

import { newCity } from '../hooks/city'
import { drawPeople } from '../hooks/people'
import { weatherAt } from '../hooks/weather'

const JUL = Date.UTC(2026, 6, 10)

function count(citizens: number, opts: { isNight?: boolean; fireworks?: boolean; entrances?: number[]; now?: number } = {}) {
  const now = opts.now ?? JUL
  const c = { ...newCity(1), citizens, fireworksUntil: opts.fireworks ? now + 5000 : 0 }
  const heads = new Set<number>()
  const street = {
    W: 120,
    ground: 20,
    now,
    isNight: opts.isNight ?? false,
    shade: (col: number) => col,
    set: (x: number, y: number) => {
      if (y === 20 && x >= 0 && x < 120) heads.add(x)
    },
  }
  drawPeople(street, c, { ...weatherAt(now, c), kind: 'clear', intensity: 0 }, opts.entrances ?? [], 0)
  return heads.size
}

test('a bigger city has busier streets', async () => {
  expect(count(240)).toBeGreaterThan(count(12) + 10)
})

test('fewer people are out at night', async () => {
  expect(count(240, { isNight: true })).toBeLessThan(count(240))
})

test('crowds gather for fireworks', async () => {
  expect(count(12, { fireworks: true })).toBeGreaterThan(count(12))
})

test('commuters come up out of subway entrances', async () => {
  let most = 0
  for (let t = 0; t < 40_000; t += 1000) most = Math.max(most, count(1, { entrances: [60], now: JUL + t }) - count(1, { now: JUL + t }))
  expect(most).toBeGreaterThan(1)
})
