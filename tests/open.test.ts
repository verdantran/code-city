import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

/** Starts a session, returning a list that collects the id of every pane opened from then on. */
async function panesOpened(...[$, on]: Parameters<TestBody>) {
  const opened: string[] = []
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 8, 12) })
  let polls = 0
  on('agent.list', async () => {
    polls += 1
    return { value: [] }
  })
  // The engine services a session start leans on; no HOME keeps the city off disk.
  on('session.start', async ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', async () => ({ value: '/tmp/some-project' }))
  on('env.get', async () => ({ value: undefined }))
  on('store.get', async () => ({ value: undefined }))
  on('command.register', async () => ({ value: { command: 'city' } }))
  on('ui.open', async ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true as const } }
  })
  await $.session.start({ cwd: '/tmp/some-project', surface: 'terminal', isInteractive: true })
  return Object.assign(opened, { clock, polls: () => polls })
}

test('the pane stays shut at the start of a session unless asked for', async ($, on) => {
  expect(await panesOpened($, on)).toEqual([])
})

test('with the option on, the pane opens at the start of a session', { options: { autoOpen: true } }, async ($, on) => {
  expect(await panesOpened($, on)).toEqual(['code-city'])
})

test('/city still opens the pane with the option off', async ($, on) => {
  const opened = await panesOpened($, on)
  await $.command.run({ command: 'city', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
  expect(opened).toEqual(['code-city'])
})

test('nothing runs in the background until /city', async ($, on) => {
  const session = await panesOpened($, on)
  await session.clock.advance(10_000)
  expect(session.polls()).toBe(0)
  await $.command.run({ command: 'city', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
  await session.clock.advance(10_000)
  expect(session.polls()).toBeGreaterThan(0)
})

test('with the option on, the city runs from the start', { options: { autoOpen: true } }, async ($, on) => {
  const session = await panesOpened($, on)
  await session.clock.advance(10_000)
  expect(session.polls()).toBeGreaterThan(0)
})
