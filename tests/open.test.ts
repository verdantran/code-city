import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

/** Starts a session, returning a list that collects the id of every pane opened from then on. */
async function panesOpened(...[$, on]: Parameters<TestBody>) {
  const opened: string[] = []
  mock.clock(on, { now: Date.UTC(2026, 9, 8, 12) })
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
  return opened
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
