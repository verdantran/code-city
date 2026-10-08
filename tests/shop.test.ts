import { expect, mock, test } from 'claude-code/testing'

import { frame, newCity, tick } from '../hooks/city'
import { balanceOf, buy, CATALOG, formatTokens, RESERVED_KEYS, weighTokens } from '../hooks/shop'

const rich = (tokens: number) => ({ ...newCity(1), tokens })

test('cache reads count a tenth', async () => {
  expect(weighTokens({ input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 2000, cache_read_input_tokens: 100_000 })).toBe(13_500)
  expect(formatTokens(1_250_000)).toBe('1.3M')
  expect(formatTokens(48_200)).toBe('48k')
})

test('buying needs enough tokens and only works once', async () => {
  expect(buy(rich(100_000), 'trees').error).toContain('50k more tokens')
  const bought = buy(rich(200_000), 'trees').city!
  expect(balanceOf(bought)).toBe(50_000)
  expect(buy({ ...bought, tokens: 10_000_000 }, 'trees').error).toContain('already')
})

test('a landmark joins the street without overlapping anything', async () => {
  let c = { ...newCity(1), bricks: 2000, citizens: 60 }
  for (let t = 0; t < 80; t++) c = tick(c, t * 2000)
  const bought = buy({ ...c, tokens: 5_000_000 }, 'stadium').city!
  const special = bought.buildings.find(b => b.special === 'stadium')
  expect(special?.w).toBe(18)
  const sorted = [...bought.buildings].sort((a, b) => a.x - b.x)
  expect(sorted.every((b, i) => i === 0 || b.x > sorted[i - 1]!.x + sorted[i - 1]!.w - 1)).toBe(true)
  let built = bought
  for (let t = 0; t < 20; t++) built = tick({ ...built, bricks: built.bricks + 50 }, t)
  expect(built.buildings.find(b => b.special === 'stadium')?.floors).toBe(1)
})

test('city hall doubles idle income and express digs faster', async () => {
  const base = { ...newCity(1), citizens: 100, bricks: 0, buildings: [] }
  const plain = tick(base, 0).bricks
  const hall = tick({ ...base, owned: ['cityhall' as const] }, 0).bricks
  expect(hall).toBe(plain * 2)

  const street = newCity(1).buildings.map(b => ({ ...b, w: 60, floors: 1 }))
  const digging = { ...newCity(1), citizens: 100, bricks: 1000, buildings: street }
  expect(tick({ ...digging, owned: ['express' as const] }, 0).tunnel).toBe(2 * (tick(digging, 0).tunnel ?? 0))
})

test('the pane switches to the shop and back', async ($, on) => {
  mock.clock(on, { now: Date.UTC(2026, 6, 10) })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'code-city',
      surface,
      component: 'Pane',
      requestId: 'code-city',
      props: { title: 'City', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 24 }, view: {} },
    })
    expect(await ui.find({ text: /0 tokens/ })).toBeDefined()
    expect(await ui.find({ text: /25k more for flower beds/ })).toBeDefined()
    expect(await ui.find({ text: /s shop · v map/ })).toBeDefined()
    await ui.press({ key: 'shop' })
    expect(await ui.find({ text: /City shop/ })).toBeDefined()
    expect(await ui.find({ key: 'buy-rocket' })).toBeDefined()
    if (surface === 'terminal') expect(await ui.find({ key: 'skyline' })).toBeDefined()
    await ui.press({ key: 'shop' })
    expect(await ui.find({ text: /City shop/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('each model request adds its tokens as it finishes', async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 6, 10) })
  const usage = { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 20_000, model: 'test' }
  on('turn.step', async function* ($, e) {
    return { turnId: e.turnId, index: e.index, answer: 'ok', toolUses: [], stopReason: 'end_turn', usage }
  })
  const ui = await $.ui.mount({
    plugin: 'code-city',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'code-city',
    props: { title: 'City', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 24 }, view: {} },
  })
  expect(await ui.find({ text: /^0 tokens/ })).toBeDefined()
  for (const index of [0, 1]) {
    const stream = $.turn.step({ turnId: 't1', index, model: 'test', messageCount: 1 })
    for await (const _ of stream);
    await clock.settle()
    expect(await ui.find({ text: index === 0 ? /^4k tokens/ : /^7k tokens/ })).toBeDefined()
  }
  await ui.unmount()
})

test('the catalogue climbs to a billion, with no hotkey clash', async () => {
  expect(formatTokens(1_000_000_000)).toBe('1B')
  expect(formatTokens(1_500_000_000)).toBe('1.5B')
  expect(formatTokens(15_000_000)).toBe('15M')
  expect(buy(rich(999_999_999), 'ring').error).toContain('more tokens')
  const ring = buy(rich(1_000_000_000), 'ring').city!
  expect(balanceOf(ring)).toBe(0)
  const elevator = buy(rich(600_000_000), 'elevator').city!
  expect(elevator.buildings.some(b => b.special === 'elevator')).toBe(true)
})

test('every item has its own hotkey, clear of the pane\'s buttons', async () => {
  const keys = CATALOG.map(i => i.hotkey)
  expect(new Set(keys).size).toBe(CATALOG.length)
  expect(keys.every(k => /^[a-z0-9]$/.test(k) && !RESERVED_KEYS.includes(k))).toBe(true)
})

test('every item can be bought and changes the picture', async () => {
  let c = { ...newCity(1), bricks: 2000, citizens: 60 }
  for (let t = 0; t < 80; t++) c = tick(c, t * 2000)
  // Noon and midnight over half an hour, so day-only, night-only and occasional visitors all get a look.
  const moments = [Date.UTC(2026, 6, 10, 12), Date.UTC(2026, 6, 10, 0)].flatMap(at => Array.from({ length: 12 }, (_, k) => at + k * 151_000 + 12_000))
  for (const item of CATALOG) {
    if (item.kind === 'upgrade') continue
    let bought = buy({ ...c, tokens: item.price }, item.id).city!
    expect(bought.owned).toContain(item.id)
    for (let t = 0; t < 30; t++) bought = tick({ ...bought, bricks: bought.bricks + 50 }, t)
    const before = { ...bought, owned: [], buildings: bought.buildings.filter(b => b.special !== item.id) }
    const changed = moments.some(now => JSON.stringify(frame(bought, 120, 30, now)) !== JSON.stringify(frame(before, 120, 30, now)))
    expect({ item: item.id, changed }).toEqual({ item: item.id, changed: true })
  }
})
