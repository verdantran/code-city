import { expect, mock, test } from 'claude-code/testing'

import { newCity, nudge, scrolled } from '../hooks/city'

const wide = { ...newCity(1), buildings: [{ id: 1, x: 0, w: 100, kind: 'house' as const, floors: 1, target: 1, hue: 0 }] }

test('the street sweeps on its own until nudged', async () => {
  expect(scrolled(wide, 40, 0)).toBe(0)
  expect(scrolled(wide, 40, 220 * 10)).toBe(10)
  expect(scrolled(newCity(1), 40, 220 * 10)).toBe(0)
})

test('a nudge holds the street in place, then the sweep resumes from there', async () => {
  const pan = nudge(wide, 40, 220 * 10, { at: 0, since: 0 }, -4, 3000)
  expect(scrolled(wide, 40, 220 * 10, pan)).toBe(6)
  expect(scrolled(wide, 40, 220 * 10 + 3000, pan)).toBe(6)
  expect(scrolled(wide, 40, 220 * 10 + 3000 + 220 * 5, pan)).toBe(11)
})

test('nudges stop at either end, and a sweep heading back keeps heading back', async () => {
  expect(scrolled(wide, 40, 0, nudge(wide, 40, 0, { at: 0, since: 0 }, -4, 3000))).toBe(0)
  const end = nudge(wide, 40, 0, { at: 0, since: 0 }, 500, 3000)
  expect(scrolled(wide, 40, 0, end)).toBe(60)
  const returning = nudge(wide, 40, 220 * 70, { at: 0, since: 0 }, 4, 0)
  expect(scrolled(wide, 40, 220 * 70, returning)).toBe(54)
  expect(scrolled(wide, 40, 220 * 72, returning)).toBe(52)
})

test('a and d scroll the street while the shop is shut, and buy as before while it is open', async ($, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 8, 21) })
  const ui = await $.ui.mount({
    plugin: 'code-city',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'code-city',
    props: { title: 'City', isFocused: true, bodyColumns: 64, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
  })
  expect(await ui.find({ text: /a\/d scroll/ })).toBeDefined()
  await ui.press({ key: 'pan-left' })
  await ui.press({ key: 'pan-right' })
  await ui.press({ key: 'shop' })
  expect(await ui.find({ key: 'pan-left' })).toBeUndefined()
  expect(await ui.find({ key: 'buy-trees' })).toBeDefined()
  await ui.unmount()
})
