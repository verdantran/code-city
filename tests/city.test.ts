import { expect, test } from 'claude-code/testing'

import { capOf, frame, milestones, newCity, paint, stationsOf, tick, tierOf, WORLD } from '../hooks/city'

test('idle ticks raise the first house and then open new lots', async () => {
  let c = { ...newCity(1), bricks: 200, citizens: 40 }
  for (let t = 0; t < 40; t++) c = tick(c, t * 2000)
  expect(c.buildings[0]?.floors).toBe(1)
  expect(c.buildings.length).toBeGreaterThan(3)
  expect(c.buildings.every(b => b.x + b.w <= WORLD)).toBe(true)
})

test('tests plant parks and power raises factories', async () => {
  let c = { ...newCity(1), bricks: 100, parks: 1, power: 20 }
  c.buildings = c.buildings.map(b => ({ ...b, floors: b.target }))
  c = tick(c, 0)
  expect(c.buildings.at(-1)?.kind).toBe('park')
  c = tick(c, 2000)
  expect(c.buildings.at(-1)?.kind).toBe('factory')
})

test('a full street grows upward instead', async () => {
  let c = { ...newCity(1), bricks: 100000, citizens: 300 }
  for (let t = 0; t < 600; t++) c = tick(c, t * 2000)
  expect(Math.max(...c.buildings.map(b => b.target))).toBeGreaterThan(5)
  expect(tierOf(c)).toBe('City')
})

test('a frame packs every cell', async () => {
  const cells = frame(newCity(1), 30, 10, 60_000)
  expect(cells.length).toBe(Math.ceil((30 * 10 * 12) / 3) * 4)
})

test('drones and neighbouring districts paint into the sky', async () => {
  const c = newCity(1)
  const empty = paint(c, 60, 24, 60_000)
  const busy = paint(c, 60, 24, 60_000, {
    agents: [{ id: 'a1', type: 'Explore', description: 'search', status: 'running' }],
    neighbours: [
      { id: 'n1', slug: 'api', project: 'api', isBusy: true, tier: 'Town', skyline: [3, 6, 2, 8], agents: [] },
    ],
  })
  const changed = busy.filter((px, i) => px !== empty[i]).length
  expect(changed).toBeGreaterThan(10)
})

test('a growing town builds a mix of kinds and widths', async () => {
  let c = { ...newCity(1), bricks: 5000, citizens: 120 }
  for (let t = 0; t < 300; t++) c = tick(c, t * 2000)
  const kinds = new Set(c.buildings.map(b => b.kind))
  const widths = new Set(c.buildings.map(b => b.w))
  expect(kinds.size).toBeGreaterThan(4)
  expect(widths.size).toBeGreaterThan(3)
})

test('the subway waits for a town, then digs, runs trains and opens stations', async () => {
  let small = { ...newCity(1), bricks: 5000, citizens: 50 }
  for (let t = 0; t < 100; t++) small = tick(small, t * 2000)
  expect(small.tunnel).toBe(0)

  let town = { ...newCity(1), bricks: 5000, citizens: 100 }
  const news: string[] = []
  for (let t = 0; t < 200; t++) {
    const next = tick(town, t * 2000)
    news.push(...milestones(town, next))
    town = next
  }
  expect(town.tunnel ?? 0).toBeGreaterThan(40)
  expect(town.tunnel2).toBe(0)
  expect(stationsOf(town)).toBeGreaterThan(0)
  expect(news).toContain('Ground broken on the Red Line subway!')
  expect(news).toContain('The first Red Line train is running!')
})

test('old saves without tunnels still paint', async () => {
  const { tunnel, tunnel2, ...old } = newCity(1)
  expect(paint(old, 40, 30, 1000).length).toBe(1200)
})

test('heights vary within a kind, even in a mature city', async () => {
  let c = { ...newCity(1), bricks: 100000, citizens: 300 }
  for (let t = 0; t < 900; t++) c = tick(c, t * 2000)
  const towers = c.buildings.filter(b => b.kind === 'tower').map(b => b.target)
  const apartments = c.buildings.filter(b => b.kind === 'apartment').map(b => b.target)
  expect(new Set(towers).size).toBeGreaterThan(3)
  expect(new Set(apartments).size).toBeGreaterThan(2)
  expect(c.buildings.every(b => b.kind === 'park' || b.kind === 'special' || b.target <= capOf(b))).toBe(true)
})
