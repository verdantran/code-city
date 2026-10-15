import type { TestBody } from 'claude-code/testing'

/** Starts a session off disk and opts it in with /city, as a person does before the pane appears. */
export async function optIn(...[$, on]: Parameters<TestBody>) {
  on('session.start', async ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', async () => ({ value: '/tmp/some-project' }))
  on('env.get', async () => ({ value: undefined }))
  on('store.get', async () => ({ value: undefined }))
  on('command.register', async () => ({ value: { command: 'city' } }))
  on('ui.open', async () => ({ value: { isPlaced: true as const } }))
  await $.session.start({ cwd: '/tmp/some-project', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'city', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
}
