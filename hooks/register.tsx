import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentView, City, District, ItemId, Ledger, LogLine, Neighbour, View } from '../types'
import { agentColor, frame, happenings, hex, milestones, newCity, pack, skyAt, stationsOf, tick, tierOf } from './city'
import { paintRegion, ZOOMS } from './iso'
import { clean, fnv, isOurFile, MAX_SESSIONS, num, sanitizeCity, sanitizeLedger, sanitizeNeighbour, stamp } from './safe'
import type { FileKind } from './safe'
import { balanceOf, buy, CATALOG, formatTokens, owns, weighTokens } from './shop'
import { applyLedger, contest, emptyLedger, LEDGER_FRESH_MS, pruneApplied, slugOf } from './sync'
import type { Lease } from './sync'
import { weatherAt, weatherLabel } from './weather'

const PANE = 'code-city'
const city = atom({ plugin: 'code-city', key: 'city' } as const, newCity(0))
const ledger = atom({ plugin: 'code-city', key: 'ledger' } as const, emptyLedger())
const log = atom({ plugin: 'code-city', key: 'log' } as const, [] as LogLine[])
/** The log as stored, re-checked: a session that hot-reloads keeps what older code wrote. */
export const logLines = (value: unknown): LogLine[] =>
  Array.isArray(value)
    ? value
        .filter((l): l is { at: unknown; text: unknown } => typeof l === 'object' && l !== null)
        .map(l => ({ at: num(l.at, 0, 1e15), text: clean(l.text, 120) }))
        .filter(l => l.text)
    : []
const view = atom({ plugin: 'code-city', key: 'view' } as const, 'street' as View)
// Renamed from older keys, so whatever older code stored there is never drawn.
const region = atom({ plugin: 'code-city', key: 'districts' } as const, [] as District[])
const zoom = atom({ plugin: 'code-city', key: 'zoom' } as const, 1)
const ZOOM_NAMES = ['near', 'mid', 'far']
const agents = atom({ plugin: 'code-city', key: 'drones' } as const, [] as AgentView[])
const neighbours = atom({ plugin: 'code-city', key: 'nearby' } as const, [] as Neighbour[])
const sessionsHere = atom({ plugin: 'code-city', key: 'sessionsHere' } as const, 1)
const self = atom({ plugin: 'code-city', key: 'self' } as const, '')
const isShopOpen = atom({ plugin: 'code-city', key: 'isShopOpen' } as const, false)
const HOTKEYS = 'abcdefghijklmnopqrtu'
const LIVE = ['pending', 'running', 'waiting', 'idle']
const STALE_MS = 15_000
const MAX_REGION = 40
const REGION_SCAN = 200
const MAX_NEIGHBOURS = 50
const WRITE_TIMEOUT_MS = 5_000
const TOAST_GAP_MS = 10_000
const LOG_KEEP = 40
const MAX_READ = 1_000_000
const SESSION_FILE = /^[A-Za-z0-9-]{1,64}\.json$/

const lines = (s: string | undefined) => (s ? s.split('\n').length : 0)
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const projectOf = (cwd: string) => clean(cwd.split('/').filter(Boolean).pop() ?? cwd, 48) || 'project'

/** The folder a project's city lives in: the readable slug plus a hash of the full path, so near-identical paths stay apart. */
export const cityFolderOf = (cwd: string) => `${slugOf(cwd)}--${fnv(cwd).slice(0, 6)}`
const HASHED = /--[0-9a-f]{6}$/

const local = {
  storeKey: 'city',
  root: '',
  rootReal: '',
  cityDir: '',
  citiesDir: '',
  presenceDir: '',
  slug: '',
  legacySlug: '',
  project: '',
  turnTokens: 0,
  isBusy: false,
  self: '',
  isMayor: false,
  isOffline: false,
  corrupt: 0,
  hasSynced: false,
  isEnded: false,
  isClosing: false,
  reported: new Set<string>(),
  lastToast: 0,
  cityCache: new Map<string, { mtime: number; size: number; city: City }>(),
  inboxQueue: Promise.resolve() as Promise<unknown>,
  presenceWrite: Promise.resolve() as Promise<unknown>,
  timers: [] as { cancel: () => void }[],
}

const paths = () => ({
  city: `${local.cityDir}/city.json`,
  lease: `${local.cityDir}/mayor.json`,
  inbox: `${local.cityDir}/inbox`,
  presence: `${local.presenceDir}/${local.self}.json`,
})

/** Parsed JSON from a regular file of ours, or undefined: no links, pipes or oversized files. */
async function readSafe($: EngineInterface, path: string): Promise<unknown> {
  if (local.isOffline) return undefined
  const stat = await $.fs.stat(path).catch(() => undefined)
  if (!stat || stat.kind !== 'file' || stat.isLink || stat.size > MAX_READ) return undefined
  return $.fs
    .read(path)
    .then(text => JSON.parse(text) as unknown)
    .catch(() => undefined)
}

const sameName = (a: string, b: string) => a.normalize('NFC').toLowerCase() === b.normalize('NFC').toLowerCase()

/** Whether a write to `path` lands inside our own folder: the file, or its nearest existing folder, resolves under it. */
async function isOurs($: EngineInterface, path: string) {
  if (!local.rootReal || !path.startsWith(`${local.root}/`)) return false
  for (let p = path; p.length >= local.root.length; p = p.slice(0, p.lastIndexOf('/'))) {
    const stat = await $.fs.stat(p, { resolve: true }).catch(() => undefined)
    if (!stat) {
      // Nothing resolves here; refuse if an entry by this name exists all the same (a link to nowhere).
      // Names compare without case: macOS folders treat "A.json" and "a.json" as one file.
      const parent = p.slice(0, p.lastIndexOf('/'))
      const name = p.slice(p.lastIndexOf('/') + 1)
      const entries = await $.fs.list(parent).catch(() => [])
      if (entries.some(f => sameName(f.name, name))) return false
      continue
    }
    if (p === path && (stat.isLink || stat.kind !== 'file')) return false
    const real = stat.realPath ?? ''
    return real === local.rootReal || real.startsWith(`${local.rootReal}/`)
  }
  return false
}

/** Resolves to the work's result, or undefined once `ms` pass; the work itself carries on. */
function within<T>($: EngineInterface, ms: number, work: Promise<T>): Promise<T | undefined> {
  return new Promise(resolve => {
    $.clock.after(Math.max(1, ms), () => resolve(undefined))
    work.then(resolve, () => resolve(undefined))
  })
}

/**
 * Writes inside our folder only, and only over a file that is empty or already holds our own stamped data
 * of this kind: a hard link to some other file can't be told apart by path, but it won't carry our stamp.
 */
async function writeSafe($: EngineInterface, kind: FileKind, path: string, data: object) {
  if (local.isOffline || !(await isOurs($, path))) return false
  const stat = await $.fs.stat(path).catch(() => undefined)
  if (stat && stat.size > 0 && !isOurFile(kind, await readSafe($, path))) {
    await warnOnce($, kind, path)
    return false
  }
  await $.fs.write(path, stamp(kind, data))
  return true
}

async function warnOnce($: EngineInterface, kind: string, path: string) {
  if (local.reported.has(kind)) return
  local.reported.add(kind)
  await note($, `Code City won't overwrite ${path}: it isn't a ${kind} file it wrote. Delete it to recover.`)
}

async function readNeighbours($: EngineInterface, now: number) {
  const entries = (await $.fs.list(local.presenceDir).catch(() => []))
    .filter(f => f.kind === 'file' && !f.isLink && SESSION_FILE.test(f.name) && f.name !== `${local.self}.json` && now - f.mtimeMs < STALE_MS)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, MAX_NEIGHBOURS)
  const others: Neighbour[] = []
  let here = 0
  for (const f of entries) {
    const n = sanitizeNeighbour(await readSafe($, `${local.presenceDir}/${f.name}`))
    if (!n) continue
    if (n.slug === local.slug) here += 1
    else others.push(n)
  }
  return { others: others.sort((a, b) => a.id.localeCompare(b.id)), here }
}

/** The shared city as this session sees it: with its own earnings the mayor has not collected yet. */
async function seen($: EngineInterface) {
  const [shared, mine, me] = [await read($, city), await read($, ledger), await read($, self)]
  return applyLedger(shared, me || 'local', mine, 0)
}

const bonus = (c: City) => (owns(c, 'brickworks') ? 1.5 : 1)

/** An exact item id or name, or a prefix of 3+ letters that matches only one item. */
export function findItem(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return undefined
  const exact = CATALOG.find(i => i.id === q || i.name.toLowerCase() === q)
  if (exact || q.length < 3) return exact
  const starts = CATALOG.filter(i => i.id.startsWith(q) || i.name.toLowerCase().startsWith(q) || i.name.toLowerCase().split(' ').some(w => w.startsWith(q)))
  return starts.length === 1 ? starts[0] : undefined
}

async function record($: EngineInterface, fn: (l: Ledger) => Ledger) {
  await update($, ledger, fn)
  if (!local.cityDir || !local.self || local.isClosing) return
  // One write at a time, each of the newest totals, so the inbox never steps backwards; a stuck write gives up.
  local.inboxQueue = local.inboxQueue
    .then(async () => within($, WRITE_TIMEOUT_MS, writeSafe($, 'ledger', `${paths().inbox}/${local.self}.json`, await read($, ledger))))
    .catch(() => undefined)
}

async function note($: EngineInterface, text: string | string[]) {
  const texts = (typeof text === 'string' ? [text] : text).map(t => clean(t, 120)).filter(Boolean)
  if (!texts.length) return
  const at = await $.clock.now()
  await update($, log, lines => [...logLines(lines), ...texts.map(text => ({ at, text }))].slice(-LOG_KEEP))
}

async function earn($: EngineInterface, fn: (l: Ledger) => Ledger, message: string) {
  await record($, fn)
  await note($, message)
}

/** Runs game bookkeeping after the hook has returned, so prompts and tool results never wait on it. */
function later($: EngineInterface, work: () => Promise<unknown>) {
  $.clock.after(0, () => void work().catch(() => undefined))
}

const twoDigits = (n: number) => String(n).padStart(2, '0')
const clock = (at: number) => {
  const d = new Date(at)
  return `${twoDigits(d.getHours())}:${twoDigits(d.getMinutes())}`
}

const nameFromSlug = (slug: string) => slug.replace(HASHED, '').replace(/^Users-[^-]+-/, '').replace(/^projects-/, '')

/** Every city saved on this machine, for the map: this one live, the rest as last saved. */
async function refreshRegion($: EngineInterface) {
  const live = await read($, neighbours)
  const dirs = (await $.fs.list(local.citiesDir).catch(() => [])).filter(d => d.kind === 'dir' && !d.isLink && /^[A-Za-z0-9-]{1,160}$/.test(d.name))
  const moved = new Set(dirs.filter(d => HASHED.test(d.name)).map(d => d.name.replace(HASHED, '')))
  const candidates = dirs
    .filter(d => d.name !== local.slug && d.name !== local.legacySlug && (HASHED.test(d.name) || !moved.has(d.name)))
    .slice(0, REGION_SCAN)
  const dated = await Promise.all(
    candidates.map(async d => {
      const stat = await $.fs.stat(`${local.citiesDir}/${d.name}/city.json`).catch(() => undefined)
      return { d, at: stat?.kind === 'file' ? stat.mtimeMs : -1, size: stat?.size ?? 0 }
    }),
  )
  const recent = dated
    .filter(x => x.at >= 0)
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_REGION - 1)
  const found: District[] = []
  for (const { d: dir, at, size } of recent) {
    const cached = local.cityCache.get(dir.name)
    const c = cached && cached.mtime === at && cached.size === size ? cached.city : sanitizeCity(await readSafe($, `${local.citiesDir}/${dir.name}/city.json`))
    if (!c) continue
    local.cityCache.set(dir.name, { mtime: at, size, city: c })
    const sessions = live.filter(n => n.slug === dir.name)
    found.push({
      slug: dir.name,
      name: c.project ?? nameFromSlug(dir.name),
      city: c,
      isHere: false,
      isBusy: sessions.some(n => n.isBusy),
      agents: sessions.flatMap(n => n.agents).slice(0, 12),
    })
  }
  found.sort((a, b) => b.city.citizens - a.city.citizens)
  const mine: District = { slug: local.slug, name: local.project, city: await seen($), isHere: true, isBusy: false, agents: [] }
  await update($, region, () => [mine, ...found])
}

async function toggleView($: EngineInterface) {
  const next = await update($, view, v => (v === 'map' ? 'street' : 'map'))
  if (next === 'map') await refreshRegion($)
}

async function purchase($: EngineInterface, id: ItemId) {
  const attempt = buy(await seen($), id)
  if (attempt.error !== undefined) {
    $.ui.toast(attempt.error)
    return attempt.error
  }
  await record($, l => ({ ...l, purchases: [...l.purchases, id] }))
  const name = CATALOG.find(i => i.id === id)?.name ?? id
  await note($, `Bought ${name.toLowerCase()}!`)
  $.ui.toast(`${name} added to the city`)
  return `Bought ${name}.`
}

/** The city to start from when this folder has none yet: an older folder's save, the store's backup, or a new one. */
async function foundingCity($: EngineInterface, now: number) {
  // The store's backup is keyed by this exact path, so it comes first. The old folder was shared by paths that
  // differ only in punctuation: only carry it over if it was this project's.
  const backup = sanitizeCity(await $.store.get(local.storeKey))
  if (backup) return backup
  const legacy = sanitizeCity(await readSafe($, `${local.citiesDir}/${local.legacySlug}/city.json`))
  const isMine = legacy !== undefined && (legacy.project === undefined || legacy.project === local.project)
  return (isMine ? legacy : undefined) ?? newCity(now)
}

async function runCity($: EngineInterface, now: number) {
  if (local.isEnded || !local.self) return
  if (local.isOffline) {
    const shared = pruneApplied(tick(applyLedger(await read($, city), local.self, await read($, ledger), now), now), now)
    await update($, city, () => shared)
    await $.store.set(local.storeKey, shared)
    return
  }

  const raw = (await readSafe($, paths().lease)) as Partial<Lease> | undefined
  const lease = typeof raw?.id === 'string' && typeof raw.until === 'number' ? { id: raw.id, until: raw.until } : undefined
  const round = contest(lease, local.self, now)
  if (round.write) await writeSafe($, 'lease', paths().lease, round.write)
  local.isMayor = round.isMayor
  if (!local.isMayor) return

  const exists = await $.fs.exists(paths().city)
  let shared = exists ? sanitizeCity(await readSafe($, paths().city)) : await foundingCity($, now)
  if (!shared) {
    local.corrupt += 1
    if (local.corrupt < 3) return
    shared = sanitizeCity(await $.store.get(local.storeKey)) ?? newCity(now)
  }
  local.corrupt = 0
  shared = pruneApplied(shared, now)

  const entries = (await $.fs.list(paths().inbox).catch(() => []))
    .filter(f => f.kind === 'file' && !f.isLink && SESSION_FILE.test(f.name) && now - f.mtimeMs <= LEDGER_FRESH_MS)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, MAX_SESSIONS * 2)
  for (const f of entries) {
    const session = f.name.slice(0, -5)
    // At the cap a session we've no record of can't be told from one dropped earlier, so it waits.
    if (Object.keys(shared.applied ?? {}).length >= MAX_SESSIONS && !shared.applied?.[session]) continue
    const l = sanitizeLedger(await readSafe($, `${paths().inbox}/${f.name}`))
    if (l) shared = applyLedger(shared, session, l, now)
  }

  shared = pruneApplied(tick(shared, now), now)
  shared = { ...shared, rev: (shared.rev ?? 0) + 1, project: local.project }
  await writeSafe($, 'city', paths().city, shared)
  await $.store.set(local.storeKey, shared).catch(() => undefined)
}

async function pullCity($: EngineInterface) {
  const shared = sanitizeCity(await readSafe($, paths().city))
  if (!shared) return
  const before = await read($, city)
  if (local.hasSynced && shared.rev === before.rev) return
  await update($, city, () => shared)
  if (!local.hasSynced) {
    local.hasSynced = true
    return
  }
  const news = milestones(before, shared)
  const now = await $.clock.now()
  if (news.length && now - local.lastToast >= TOAST_GAP_MS) {
    local.lastToast = now
    $.ui.toast(news.join(' · '))
  }
  await note($, [...happenings(before, shared), ...news])
}

/** This session's presence: just enough for other sessions to draw it, nothing about the work itself. */
async function announce($: EngineInterface, live: AgentView[]) {
  const c = await seen($)
  const presence: Neighbour = {
    id: local.self,
    slug: local.slug,
    project: local.project,
    isBusy: local.isBusy || live.some(a => a.status === 'running'),
    tier: tierOf(c),
    skyline: c.buildings.filter(b => b.kind !== 'park').map(b => b.target),
    agents: live.map(a => ({ type: a.type, status: a.status })),
  }
  if (local.isClosing) return
  local.presenceWrite = within($, WRITE_TIMEOUT_MS, writeSafe($, 'presence', paths().presence, presence)).catch(() => undefined)
  await local.presenceWrite
}

/** The districts as drawn this frame: this city with its live state, the rest as last read. */
async function districtsNow($: EngineInterface) {
  const [all, c, mine] = [await read($, region), await seen($), await read($, agents)]
  return all.map(d => (d.isHere ? { ...d, city: c, isBusy: local.isBusy || mine.some(a => a.status === 'running'), agents: mine } : d))
}

async function settle($: EngineInterface) {
  const home = await $.env.get('HOME')
  const cwd = await $.session.cwd()
  local.storeKey = `city:${cwd}`
  local.slug = cityFolderOf(cwd)
  local.legacySlug = slugOf(cwd)
  local.project = projectOf(cwd)
  local.isOffline = !home || !home.startsWith('/') || home === '/'
  if (!home || local.isOffline) return
  local.root = `${home.replace(/\/+$/, '')}/.claude/code-city`
  local.citiesDir = `${local.root}/cities`
  local.cityDir = `${local.citiesDir}/${local.slug}`
  local.presenceDir = `${local.root}/presence`
  if (!(await $.fs.exists(local.root))) {
    // A "code-city" entry that doesn't exist is a link to nowhere: following it would put our files elsewhere.
    const claude = await $.fs.list(`${home.replace(/\/+$/, '')}/.claude`).catch(() => [])
    if (claude.some(f => sameName(f.name, 'code-city'))) {
      local.isOffline = true
      return
    }
    await $.fs.write(`${local.root}/README.txt`, 'Shared state for the Code City plugin.\n').catch(() => undefined)
  }
  const rootStat = await $.fs.stat(local.root, { resolve: true }).catch(() => undefined)
  local.rootReal = rootStat?.kind === 'dir' ? (rootStat.realPath ?? '') : ''
  if (!local.rootReal) local.isOffline = true
}

/** Drops store backups for folders that no longer exist (temporary and deleted projects). */
async function pruneStore($: EngineInterface) {
  const keys = (await $.store.keys().catch(() => [] as string[])).filter(k => k.startsWith('city:/')).slice(0, 200)
  for (const key of keys) if (key !== local.storeKey && !(await $.fs.exists(key.slice(5)).catch(() => true))) await $.store.delete(key).catch(() => undefined)
}

export const register: Register = on => {
  let mounted: { columns: number; rows: number } | undefined

  on('session.start', async ($, e, next) => {
    for (const t of local.timers.splice(0)) t.cancel()
    await $.command.register({ name: 'city', description: 'Watch your code city grow (map, shop, buy <item>)', argumentHint: '[map | shop | buy <item>]' })
    await settle($)
    const now = await $.clock.now()
    const saved = sanitizeCity(await $.store.get(local.storeKey))
    await update($, city, c => {
      const kept = sanitizeCity(c)
      return kept && kept.founded > 0 ? kept : (saved ?? newCity(now))
    })
    // State kept across a hot reload was written by older code: check it again before drawing from it.
    await update($, ledger, l => sanitizeLedger(l) ?? emptyLedger())
    await update($, log, l => logLines(l))
    local.self = await update($, self, id => (typeof id === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(id) ? id : crypto.randomUUID()))
    local.isEnded = false
    local.isClosing = false
    local.reported.clear()
    if (!local.isOffline) await pruneStore($)

    const every = (ms: number, work: () => Promise<unknown>) => {
      let isRunning = false
      local.timers.push(
        $.clock.every(ms, () => {
          if (isRunning || local.isEnded) return
          isRunning = true
          void work()
            .catch(() => undefined)
            .finally(() => {
              isRunning = false
            })
        }),
      )
    }

    every(2000, async () => runCity($, await $.clock.now()))
    every(1000, async () => pullCity($))

    every(2500, async () => {
      const now = await $.clock.now()
      const before = await read($, agents)
      const listed = await $.agent.list()
      const live = listed
        .filter(a => LIVE.includes(a.status))
        .map(a => ({ id: a.id, type: clean(a.type, 32) || 'agent', description: clean(a.description, 100), status: a.status }))
      await update($, agents, () => live)

      for (const a of before.filter(a => !live.some(l => l.id === a.id))) {
        const ok = listed.find(l => l.id === a.id)?.status !== 'failed'
        await earn($, l => ({ ...l, bricks: l.bricks + (ok ? 15 : 3) }), `${a.type} drone ${ok ? 'landed' : 'crashed'}: ${a.description}${ok ? ' (+15 bricks)' : ''}`)
      }

      if (local.isOffline) return
      await announce($, live)
      const found = await readNeighbours($, now)
      await update($, neighbours, () => found.others)
      await update($, sessionsHere, () => found.here + 1)
      if ((await read($, view)) === 'map') await refreshRegion($)
    })

    every(120, async () => {
      if (!mounted) return
      const now = await $.clock.now()
      const cells =
        (await read($, view)) === 'map'
          ? pack(paintRegion(await districtsNow($), mounted.columns, mounted.rows * 2, now, await read($, zoom)), mounted.columns, mounted.rows)
          : frame(await seen($), mounted.columns, mounted.rows, now, { agents: await read($, agents), neighbours: await read($, neighbours) })
      const res = await $.ui.blit({ requestId: PANE, key: 'skyline', cells, ...mounted })
      if (res.deny) mounted = undefined
    })

    void $.ui.open({ id: PANE, title: 'City', columns: 64, rows: 20 })
    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear' || e.reason === 'resume') return next(e)
    for (const t of local.timers.splice(0)) t.cancel()
    local.isClosing = true
    try {
      if (!local.isOffline && local.self) {
        // Privacy first: wait out any presence write already under way, then blank the file. Every wait is bounded,
        // since the whole exit shares one short window with other plugins.
        await within($, 300, local.presenceWrite)
        await within($, 300, writeSafe($, 'presence', paths().presence, {}))
        await within($, 300, local.inboxQueue)
        const left = next.budget.remainingMs
        if (local.isMayor && left > 1_000) await within($, left - 500, runCity($, await $.clock.now()))
        if (local.isMayor) await within($, 200, writeSafe($, 'lease', paths().lease, { id: local.self, until: 0 }))
      }
    } finally {
      local.isEnded = true
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'city' }, async ($, e) => {
    const [verb = '', ...rest] = e.args.trim().split(/\s+/)
    if (verb === 'buy') {
      const query = clean(rest.join(' '), 40)
      if (!query) return { text: 'Usage: /city buy <item>. Open /city shop to see what is for sale.' }
      const item = findItem(query)
      if (!item) return { text: `Nothing called "${query}" is for sale. Try /city shop.` }
      return { text: await purchase($, item.id) }
    }
    if (verb === 'map') {
      await toggleView($)
      await $.ui.open({ id: PANE, title: 'City', columns: 64, rows: 20 })
      return { text: (await read($, view)) === 'map' ? 'Showing every city on the map.' : 'Back to the street.' }
    }
    await update($, isShopOpen, () => verb === 'shop')
    await $.ui.open({ id: PANE, title: 'City', columns: 64, rows: 20 })
    const c = await seen($)
    if (verb === 'shop') return { text: `The shop is open: ${formatTokens(balanceOf(c))} tokens to spend.` }
    return { text: `${tierOf(c)} of ${Math.floor(c.citizens)} citizens, ${formatTokens(balanceOf(c))} tokens to spend.` }
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    local.isBusy = true
    local.turnTokens = 0
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      local.isBusy = false
      const used = local.turnTokens
      local.turnTokens = 0
      if (used > 0) later($, () => note($, `That turn used ${formatTokens(used)} tokens`))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    try {
      const usage = result.usage
      if (usage) {
        const n = weighTokens(usage)
        local.turnTokens += n
        later($, () => record($, l => ({ ...l, tokens: l.tokens + n })))
      }
    } catch {
      // Bookkeeping must never disturb the model's reply.
    }
    return result
  })

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    if (spawned.deny === undefined) {
      const what = `${clean(e.subagentType, 32)} drone launched: ${clean(e.description, 100)}`
      later($, () => earn($, l => ({ ...l, citizens: l.citizens + 1 }), what))
    }
    return spawned
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    later($, () => earn($, l => ({ ...l, citizens: l.citizens + 2, bricks: l.bricks + 3, prompts: l.prompts + 1 }), 'New arrivals: +2 citizens'))
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) {
      const base = clamp(lines(e.new_string), 2, 40)
      const file = clean(e.file_path.split('/').pop(), 60)
      later($, async () => {
        const n = base * bonus(await seen($))
        await earn($, l => ({ ...l, bricks: l.bricks + n, edits: l.edits + 1 }), `Edit ${file}: +${Math.round(n)} bricks`)
      })
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) {
      const base = clamp(Math.round(lines(e.content) / 2), 5, 60)
      const file = clean(e.file_path.split('/').pop(), 60)
      later($, async () => {
        const n = base * bonus(await seen($))
        await earn($, l => ({ ...l, bricks: l.bricks + n, edits: l.edits + 1, citizens: l.citizens + 1 }), `Wrote ${file}: +${Math.round(n)} bricks`)
      })
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined) return ran
    const cmd = e.command
    const isCommit = /\bgit\s+commit\b/.test(cmd)
    const isTest = /\b(test|jest|vitest|pytest|mocha|cargo test|go test)\b/.test(cmd)
    const failed = ran.isError === true
    later($, async () => {
      const now = await $.clock.now()
      if (failed) return earn($, l => ({ ...l, showerUntil: now + 12_000 }), 'A command failed: a brief shower')
      await earn(
        $,
        l => ({
          ...l,
          power: l.power + 2,
          bricks: l.bricks + 1,
          commands: l.commands + 1,
          parks: l.parks + (isTest ? 1 : 0),
          rainbowUntil: isTest ? now + 20_000 : l.rainbowUntil,
          fireworksUntil: isCommit ? now + 10_000 : l.fireworksUntil,
        }),
        isCommit ? 'Commit! Fireworks over the city' : isTest ? 'Tests passed: a rainbow, and a park is planned' : '+2 power',
      )
      if (isCommit) $.ui.toast('Fireworks over Code City!')
    })
    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const Raster = e.surface === 'terminal' ? $.ui.resolve(e).Raster : undefined
    const c = await seen($)
    const here = await read($, sessionsHere)
    const lines = logLines(await read($, log))
    const isShop = await read($, isShopOpen)
    const isMap = (await read($, view)) === 'map'
    const districts = isMap ? await districtsNow($) : []
    const zoomLevel = await read($, zoom)
    const scene = { agents: await read($, agents), neighbours: await read($, neighbours) }
    const now = await $.clock.now()
    const balance = balanceOf(c)
    const forSale = CATALOG.filter(i => !owns(c, i.id))
    const affordable = forSale.filter(i => i.price <= balance).length
    const goal = forSale.find(i => i.price > balance)

    const width = clamp(e.props.bodyColumns, 20, 240)
    const columns = width >= 105 ? 3 : width >= 70 ? 2 : 1
    const built = CATALOG.filter(i => owns(c, i.id))
    const gridRows = Math.ceil(forSale.length / columns)
    const panelRows = isShop ? gridRows + 4 + (built.length ? 1 : 0) : 3
    const shown = scene.agents.slice(0, 3)
    const legend = shown.length + (scene.agents.length > 3 ? 1 : 0) + (isMap || scene.neighbours.length ? 1 : 0)
    const logRows = e.props.scroll.bodyRows >= 26 ? 4 : 3
    const rows = clamp(e.props.scroll.bodyRows - 1 - panelRows - legend - logRows, 6, 30)
    mounted = { columns: width, rows }

    const building = c.buildings.some(b => b.floors < b.target)
    const sky = weatherLabel(weatherAt(now, c), skyAt(now).isNight)
    const stats = `${tierOf(c)} · ${Math.floor(c.citizens)} citizens · ${Math.floor(c.bricks)} bricks · ${Math.floor(c.power)} power · ${c.buildings.length} lots · ${sky}${stationsOf(c) ? ` · ${stationsOf(c)} stations` : ''}${here > 1 ? ` · ${here} sessions here` : ''}`
    const keys = isMap ? 's shop · v street · z zoom' : 's shop · v map'
    const keyHint = e.props.isFocused ? keys : `click or ctrl+x tab, then ${keys}`

    const progress =
      affordable > 0 ? (
        <Text bold color="green">
          {'  '}
          {affordable} {affordable === 1 ? 'item' : 'items'} ready to buy
        </Text>
      ) : goal ? (
        <Text dimColor>
          {'  '}
          {formatTokens(goal.price - balance)} more for {goal.name.toLowerCase()}
        </Text>
      ) : (
        <Text dimColor>{'  '}everything is built</Text>
      )

    const toggle = (
      <Box flexDirection="row" gap={1}>
        <Text dimColor>{keyHint}</Text>
        <Button
          key="shop"
          hotkey="s"
          label={isShop ? 'Close shop' : 'Open shop'}
          variant={isShop ? 'secondary' : 'primary'}
          onPress={() => update($, isShopOpen, open => !open)}
        />
        <Button
          key="view"
          hotkey="v"
          label={isMap ? 'Street' : 'Map'}
          onPress={() => toggleView($)}
        />
        {isMap && <Button key="zoom" hotkey="z" label={`Zoom: ${ZOOM_NAMES[zoomLevel] ?? 'mid'}`} onPress={() => update($, zoom, z => (z + 1) % ZOOMS)} />}
      </Box>
    )

    const header = (
      <Box flexDirection="row" justifyContent="space-between">
        <Text wrap="truncate-end">
          <Text bold color="yellow">
            {isShop ? 'City shop · ' : ''}
            {formatTokens(balance)} tokens
          </Text>
          {progress}
        </Text>
        {toggle}
      </Box>
    )

    const shopItems = forSale.map(item => {
      const canAfford = balance >= item.price
      return (
        <Box flexDirection="row" gap={1} width={`${Math.floor(100 / columns)}%`}>
          <Button
            key={`buy-${item.id}`}
            hotkey={HOTKEYS[CATALOG.indexOf(item)]}
            label={formatTokens(item.price)}
            dimColor={!canAfford}
            variant={canAfford ? 'primary' : 'secondary'}
            onPress={() => purchase($, item.id)}
          />
          <Text bold={canAfford} dimColor={!canAfford} wrap="truncate-end">
            {item.name}
          </Text>
        </Box>
      )
    })
    const spotlight = forSale.find(i => i.price <= balance) ?? goal

    return (
      <Box flexDirection="column">
        <Text bold wrap="truncate-end">
          {stats}
          {building ? ' · under construction' : ''}
        </Text>
        {Raster ? (
          <Raster
            key="skyline"
            columns={width}
            rows={rows}
            cells={isMap ? pack(paintRegion(districts, width, rows * 2, now, zoomLevel), width, rows) : frame(c, width, rows, now, scene)}
          />
        ) : (
          <Text dimColor>The skyline draws in the terminal.</Text>
        )}
        {shown.map(a => (
          <Text wrap="truncate-end">
            <Text color={hex(agentColor(a.type))}>◆ </Text>
            <Text bold>{a.type}</Text>
            <Text dimColor>
              {' '}
              {a.status === 'running' ? 'flying' : a.status}: {a.description}
            </Text>
          </Text>
        ))}
        {scene.agents.length > 3 && <Text dimColor>+{scene.agents.length - 3} more drones</Text>}
        {isMap && (
          <Text wrap="truncate-end">
            <Text dimColor>Cities: </Text>
            {districts.map((d, i) => (
              <Text>
                {i > 0 ? ' · ' : ''}
                <Text color={hex(agentColor(d.name))} bold={d.isHere}>
                  ⚑ {d.name}
                </Text>
                <Text dimColor>
                  {' '}
                  ({tierOf(d.city)}, {Math.floor(d.city.citizens)}
                  {d.isHere ? ', here' : d.isBusy ? ', working' : ''}
                  {d.agents.length ? `, ${d.agents.length} drones` : ''})
                </Text>
              </Text>
            ))}
          </Text>
        )}
        {!isMap && scene.neighbours.length > 0 && (
          <Text wrap="truncate-end">
            <Text dimColor>Neighbours: </Text>
            {scene.neighbours.slice(0, 6).map((n, i) => (
              <Text>
                {i > 0 ? ' · ' : ''}
                <Text color={hex(agentColor(n.project))}>{n.project}</Text>
                <Text dimColor>
                  {' '}
                  ({n.tier}, {n.isBusy ? 'working' : 'idle'}
                  {n.agents.length ? `, ${n.agents.length} drones` : ''})
                </Text>
              </Text>
            ))}
            {scene.neighbours.length > 6 && <Text dimColor> · +{scene.neighbours.length - 6} more</Text>}
          </Text>
        )}
        <Box
          key="wallet"
          borderStyle="round"
          borderColor={affordable ? 'green' : 'yellow'}
          paddingX={1}
          flexDirection="column"
        >
          {header}
          {isShop && (
            <Box flexDirection="row" flexWrap="wrap">
              {shopItems}
            </Box>
          )}
          {isShop && built.length > 0 && (
            <Text wrap="truncate-end">
              <Text color="green">✓ Built: </Text>
              <Text dimColor>{built.map(i => i.name).join(', ')}</Text>
            </Text>
          )}
          {isShop && spotlight && (
            <Text dimColor wrap="truncate-end">
              {spotlight.name}: {spotlight.blurb}. Each item's letter buys it while the pane has the keyboard.
            </Text>
          )}
        </Box>
        {lines.length === 0 ? (
          <Text dimColor>Prompt, edit and run commands to grow the city.</Text>
        ) : (
          lines.slice(-logRows).map((line, i, recent) => (
            <Box key={`log-${i}`}>
              <Text wrap="truncate-end" dimColor={i < recent.length - 1}>
                <Text dimColor>{clock(line.at)} </Text>
                {line.text}
              </Text>
            </Box>
          ))
        )}
      </Box>
    )
  }).catch(($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>Code City could not draw this frame; it will try again on the next update.</Text>
  })
}
