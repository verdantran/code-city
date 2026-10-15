import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { newCity } from '../hooks/city'
import { cityFolderOf } from '../hooks/register'
import { stamp } from '../hooks/safe'

const NOW = Date.UTC(2026, 9, 8, 12)
const ROOT = '/home/me/.claude/code-city'
const OLD = '/home/me/projects/old'
const oldDir = `${ROOT}/cities/${cityFolderOf(OLD)}`

/** A session in /home/me/projects/here, on a disk held in memory that already has a city for /home/me/projects/old. */
async function opted(...[$, on]: Parameters<TestBody>) {
  const clock = mock.clock(on, { now: NOW })
  const files = new Map<string, { text: string; at: number }>([
    [`${ROOT}/README.txt`, { text: '', at: NOW }],
    [`${oldDir}/city.json`, { text: stamp('city', { ...newCity(1), citizens: 40, project: 'old' }), at: NOW - 86_400_000 }],
    [`${oldDir}/inbox/s1.json`, { text: stamp('ledger', { bricks: 500 }), at: NOW - 3_600_000 }],
  ])
  const store = new Map<string, unknown>([[`city:${OLD}`, { ...newCity(1), project: 'old' }]])
  const isDir = (path: string) => [...files.keys()].some(f => f.startsWith(`${path}/`))
  const missing = () => Promise.reject(new Error('ENOENT'))

  on('session.start', async ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', async () => ({ value: '/home/me/projects/here' }))
  on('env.get', async () => ({ value: '/home/me' }))
  on('store.get', async ($, e) => ({ value: store.get(e.key) }))
  on('store.set', async ($, e) => ({ value: void store.set(e.key, e.value) }))
  on('store.keys', async () => ({ value: [...store.keys()] }))
  on('store.delete', async ($, e) => ({ value: void store.delete(e.key) }))
  on('command.register', async () => ({ value: { command: 'city' } }))
  on('ui.open', async () => ({ value: { isPlaced: true as const } }))
  on('agent.list', async () => ({ value: [] }))
  on('fs.exists', async ($, e) => ({ value: files.has(e.path) || isDir(e.path) }))
  on('fs.read', async ($, e) => {
    const f = files.get(e.path)
    return f ? { value: f.text } : missing()
  })
  on('fs.write', async ($, e) => ({ value: void files.set(e.path, { text: e.text, at: clock.now() }) }))
  on('fs.stat', async ($, e) => {
    const f = files.get(e.path)
    if (f) return { value: { kind: 'file' as const, size: f.text.length, mtimeMs: f.at, isLink: false, realPath: e.path } }
    return isDir(e.path) ? { value: { kind: 'dir' as const, size: 0, mtimeMs: NOW, isLink: false, realPath: e.path } } : missing()
  })
  on('fs.list', async ($, e) => {
    const names = new Map<string, { name: string; kind: 'file' | 'dir'; size: number; mtimeMs: number; isLink: boolean }>()
    for (const [path, f] of files) {
      if (!path.startsWith(`${e.path}/`)) continue
      const [name, ...deeper] = path.slice(e.path.length + 1).split('/')
      names.set(name, { name, kind: deeper.length ? 'dir' : 'file', size: f.text.length, mtimeMs: f.at, isLink: false })
    }
    return { value: [...names.values()] }
  })

  await $.session.start({ cwd: '/home/me/projects/here', surface: 'terminal', isInteractive: true })
  const city = async (args: string) =>
    (await $.command.run({ command: 'city', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })).text ?? ''
  await city('')
  return { city, files, store }
}

test('/city remove lists the other saved cities', async ($, on) => {
  const { city } = await opted($, on)
  const listed = await city('remove')
  expect(listed).toContain('old: ')
  expect(listed).toContain('40 citizens')
  expect(listed).not.toContain('here:')
})

test('removing a city blanks its files and backup, and it leaves the list', async ($, on) => {
  const { city, files, store } = await opted($, on)
  expect(await city('remove old')).toContain('Removed old')
  expect(JSON.parse(files.get(`${oldDir}/city.json`)!.text).buildings).toBeUndefined()
  expect(JSON.parse(files.get(`${oldDir}/inbox/s1.json`)!.text).bricks).toBeUndefined()
  expect(store.has(`city:${OLD}`)).toBe(false)
  expect(await city('remove')).toBe('There are no other cities to remove.')
})

test('the city you are in, an unknown name, and a city still in use are all left alone', async ($, on) => {
  const { city, files } = await opted($, on)
  expect(await city('remove here')).toContain("can't remove the city you're in")
  expect(await city('remove nowhere')).toContain('No saved city')
  const presence = { id: 'other', slug: cityFolderOf(OLD), project: 'old', isBusy: false, tier: 'Hamlet', skyline: [], agents: [] }
  files.set(`${ROOT}/presence/other.json`, { text: stamp('presence', presence), at: NOW })
  expect(await city('remove old')).toContain('still running')
  expect(JSON.parse(files.get(`${oldDir}/city.json`)!.text).citizens).toBe(40)
})

test('/city remove all clears every other city, except one still in use', async ($, on) => {
  const { city, files } = await opted($, on)
  const busy = '/home/me/projects/busy'
  const busyDir = `${ROOT}/cities/${cityFolderOf(busy)}`
  files.set(`${busyDir}/city.json`, { text: stamp('city', { ...newCity(1), citizens: 9, project: 'busy' }), at: NOW - 60_000 })
  const presence = { id: 'other', slug: cityFolderOf(busy), project: 'busy', isBusy: true, tier: 'Hamlet', skyline: [], agents: [] }
  files.set(`${ROOT}/presence/other.json`, { text: stamp('presence', presence), at: NOW })
  const said = await city('remove all')
  expect(said).toContain('Removed old.')
  expect(said).toContain('busy (a session there is still running)')
  expect(JSON.parse(files.get(`${oldDir}/city.json`)!.text).buildings).toBeUndefined()
  expect(JSON.parse(files.get(`${busyDir}/city.json`)!.text).citizens).toBe(9)
  expect(await city('remove')).not.toContain('old:')
})
