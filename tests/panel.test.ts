import { expect, mock, test } from 'claude-code/testing'

import { logLines } from '../hooks/register'

test('an older session log stored as one string reads as an empty log', async () => {
  expect(logLines('Edit app.ts: +3 bricks')).toEqual([])
  expect(logLines(undefined)).toEqual([])
  expect(logLines([{ at: 1, text: 'x' }])).toEqual([{ at: 1, text: 'x' }])
})

test('the panel draws at every size, in both views, with the shop open or shut', async ($, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 8, 21) })
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const)
    for (const placement of ['dock', 'inline'] as const)
      for (const [bodyColumns, bodyRows] of [
        [30, 6],
        [64, 12],
        [100, 30],
        [200, 60],
      ] as const) {
        const ui = await $.ui.mount({
          plugin: 'code-city',
          surface,
          component: 'Pane',
          requestId: 'code-city',
          props: { title: 'City', isFocused: placement === 'dock', bodyColumns, placement, scroll: { offset: 0, bodyRows }, view: {} },
        })
        for (const press of [undefined, 'view', 'shop', 'view', 'shop']) {
          if (press) await ui.press({ key: press })
          expect(await ui.drawn()).toBeDefined()
        }
        await ui.unmount()
      }
})
