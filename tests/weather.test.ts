import { expect, test } from 'claude-code/testing'

import { newCity, paint } from '../hooks/city'
import { weatherAt } from '../hooks/weather'

const SLOT = 150_000
const JAN = Date.UTC(2026, 0, 10)
const JUL = Date.UTC(2026, 6, 10)

function find(from: number, kind: string) {
  for (let s = 0; s < 5000; s++) {
    const at = from + s * SLOT + SLOT / 2
    if (weatherAt(at, newCity(1)).kind === kind) return at
  }
  throw new Error(`no ${kind}`)
}

test('every kind of weather turns up in its season', async () => {
  for (const kind of ['clear', 'cloudy', 'rain', 'storm', 'fog']) expect(find(JUL, kind)).toBeGreaterThan(0)
  expect(find(JAN, 'snow')).toBeGreaterThan(0)
})

test('weather is intermittent: mostly clear, never two spells running', async () => {
  const kinds = Array.from({ length: 2000 }, (_, s) => weatherAt(JUL + s * SLOT + SLOT / 2, newCity(1)).kind)
  const share = kinds.filter(k => k !== 'clear').length / kinds.length
  expect(share).toBeGreaterThan(0.12)
  expect(share).toBeLessThan(0.26)
  expect(kinds.some((k, i) => i > 0 && k !== 'clear' && kinds[i - 1] !== 'clear')).toBe(false)
})

test('summer never snows', async () => {
  const kinds = new Set<string>()
  for (let s = 0; s < 400; s++) kinds.add(weatherAt(JUL + s * SLOT, newCity(1)).kind)
  expect(kinds.has('snow')).toBe(false)
})

test('snow settles over its spell and melts after', async () => {
  const at = find(JAN, 'snow') - SLOT / 2
  const c = newCity(1)
  expect(weatherAt(at + SLOT * 0.1, c).snow).toBeLessThan(weatherAt(at + SLOT * 0.5, c).snow)
  if (weatherAt(at + SLOT * 1.5, c).kind !== 'snow') expect(weatherAt(at + SLOT * 1.9, c).snow).toBe(0)
})

test('a failed command brings a light shower and passing tests a rainbow', async () => {
  const at = find(JUL, 'clear')
  const shower = weatherAt(at, { ...newCity(1), showerUntil: at + 10_000 })
  expect(shower.kind).toBe('rain')
  expect(shower.intensity).toBeLessThan(0.5)
  expect(weatherAt(at, { ...newCity(1), rainbowUntil: at + 10_000 }).rainbow).toBe(1)
})

test('weather changes the picture', async () => {
  const c = newCity(1)
  const at = find(JUL, 'clear')
  const calm = paint(c, 60, 30, at)
  const showery = paint({ ...c, showerUntil: at + 10_000 }, 60, 30, at)
  expect(calm.filter((px, i) => px !== showery[i]).length).toBeGreaterThan(100)
})
