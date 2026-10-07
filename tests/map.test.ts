import { expect, mock, test } from 'claude-code/testing'

import type { City, District } from '../types'
import { happenings, newCity, tick } from '../hooks/city'
import { layout, paintRegion } from '../hooks/iso'

const NOON = Date.UTC(2026, 6, 10) + 60_000

function grown(citizens: number, ticks: number): City {
  let c: City = { ...newCity(1), bricks: 2000, citizens }
  for (let t = 0; t < ticks; t++) c = tick(c, t * 2000)
  return c
}

const district = (name: string, city: City, extra: Partial<District> = {}): District => ({
  slug: name,
  name,
  city,
  isHere: false,
  isBusy: false,
  agents: [],
  ...extra,
})

test('every city gets its own island, none overlapping, all within the view', async () => {
  const cities = [district('here', grown(120, 120), { isHere: true }), district('b', grown(30, 40)), district('c', newCity(1)), district('d', grown(60, 60))]
  const { placed } = layout(cities, 100, 48)
  expect(placed.length).toBe(4)
  expect(placed.find(p => p.d.isHere)?.row).toBe(0)
  for (const a of placed) {
    expect(a.left + a.size * a.T).toBeLessThan(101)
    for (const b of placed)
      if (a !== b && a.row === b.row) expect(a.left + a.size * a.T <= b.left || b.left + b.size * b.T <= a.left).toBe(true)
  }
})

test('each zoom step uses a smaller tile, down to the far overview', async () => {
  const cities = [district('here', grown(120, 120), { isHere: true }), district('b', grown(30, 40))]
  const tiles = [0, 1, 2, 3].map(z => layout(cities, 100, 48, z).T)
  for (let i = 1; i < 3; i++) expect(tiles[i]!).toBeLessThan(tiles[i - 1]!)
  expect(tiles[3]).toBe(2)
})

test('a lone small city is drawn at a larger scale than a crowded map', async () => {
  const one = layout([district('here', newCity(1), { isHere: true })], 120, 48)
  const many = layout(Array.from({ length: 6 }, (_, i) => district(`c${i}`, grown(120, 120))), 120, 48)
  expect(one.T).toBeGreaterThan(many.T)
})

test('the map paints islands over the sea, and busy cities show their drones', async () => {
  const calm = paintRegion([district('here', grown(60, 60), { isHere: true })], 100, 40, NOON)
  const busy = paintRegion(
    [district('here', grown(60, 60), { isHere: true, isBusy: true, agents: [{ type: 'Explore', status: 'running' }] })],
    100,
    40,
    NOON,
  )
  expect(new Set(calm).size).toBeGreaterThan(12)
  expect(calm.filter((px, i) => px !== busy[i]).length).toBeGreaterThan(2)
})

test('the log hears about construction, finishing, and redevelopment', async () => {
  const before = newCity(1)
  const started = { ...before, buildings: [...before.buildings, { id: 9, x: 6, w: 6, kind: 'apartment' as const, floors: 0, target: 4, hue: 0 }] }
  expect(happenings(before, started)).toEqual(['Work starts on an apartment block'])
  const finished = { ...started, buildings: started.buildings.map(b => (b.id === 9 ? { ...b, floors: 4 } : b)) }
  const halfway = { ...started, buildings: started.buildings.map(b => (b.id === 9 ? { ...b, floors: 3 } : b)) }
  expect(happenings(halfway, finished)).toEqual(['Apartment block finished at 4 floors'])
  const rebuilt = { ...finished, buildings: finished.buildings.map(b => (b.id === 9 ? { ...b, kind: 'tower' as const, floors: 0, target: 9 } : b)) }
  expect(happenings(finished, rebuilt)).toEqual(['An apartment block is redeveloped into a tower'])
})

test('the map button swaps the skyline for the map, and the log scrolls under it', async ($, on) => {
  const clock = mock.clock(on, { now: NOON })
  const ui = await $.ui.mount({
    plugin: 'code-city',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'code-city',
    props: { title: 'City', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
  })
  expect(await ui.find({ key: 'view' })).toBeDefined()
  expect(await ui.find({ text: /Cities:/ })).toBeUndefined()
  await ui.press({ key: 'view' })
  expect(await ui.find({ text: /Cities:/ })).toBeDefined()
  expect(await ui.find({ key: 'skyline' })).toBeDefined()
  expect(await ui.find({ text: /Zoom: mid/ })).toBeDefined()
  await ui.press({ key: 'zoom' })
  expect(await ui.find({ text: /Zoom: far/ })).toBeDefined()
  await ui.press({ key: 'zoom' })
  expect(await ui.find({ text: /Zoom: near/ })).toBeDefined()
  await ui.press({ key: 'view' })
  expect(await ui.find({ text: /Cities:/ })).toBeUndefined()

  for (let i = 0; i < 6; i++) await $.prompt.submit({ text: `prompt ${i}`, wait: false, origin: { kind: 'composer' } }).catch(() => undefined)
  await clock.settle()
  expect(await ui.find({ key: 'log-3' })).toBeDefined()
  expect(await ui.find({ key: 'log-4' })).toBeUndefined()
  expect(await ui.find({ text: /New arrivals/ })).toBeDefined()
  await ui.unmount()
})
