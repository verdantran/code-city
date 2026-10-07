import type { Building, City, ItemId, Kind, Ledger, Neighbour, NeighbourAgent } from '../types'
import { MAX_FLOORS, WORLD } from './city'
import { CATALOG, MAX_BUILDINGS } from './shop'
import { MAX_TUNNEL } from './underground'

const KINDS: Kind[] = ['house', 'shop', 'apartment', 'tower', 'factory', 'civic', 'landmark', 'park', 'special']
const ITEMS = new Set<string>(CATALOG.map(i => i.id))
const LANDMARK_ITEMS = new Set<string>(CATALOG.filter(i => i.kind === 'landmark').map(i => i.id))
const STATUSES = ['pending', 'running', 'waiting', 'idle']
export { MAX_BUILDINGS }
export const MAX_SESSIONS = 500
const BIG = 1e15

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// Control characters, line/paragraph separators, lone surrogate halves, bidi overrides and isolates,
// invisible spaces and fillers, and other format characters a name has no use for. ZWJ and ZWNJ stay,
// since emoji and some scripts need them; tag characters stay only inside a flag (they follow U+1F3F4).
const UNSAFE =
  /[\p{Cc}\p{Cs}\p{Zl}\p{Zp}\u00AD\u0600-\u0605\u061C\u06DD\u070F\u08E2\u115F\u1160\u180B-\u180F\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\u2800\u3164\uFEFF\uFFA0\uFFF9-\uFFFB\u{110BD}\u{13430}-\u{1343F}\u{1BCA0}-\u{1BCA3}\u{1D173}-\u{1D17A}]/gu
const LOOSE_TAGS = /(?<!\u{1F3F4}[\u{E0020}-\u{E007E}]*)[\u{E0000}-\u{E007F}]/gu
const STACKED_MARKS = /(\p{M}{4})\p{M}+/gu

const graphemes = (text: string): string[] =>
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), s => s.segment)
    : Array.from(text)

/** Text from outside the plugin: unsafe characters removed, cut to `max` whole characters. */
export function clean(value: unknown, max = 64): string {
  if (typeof value !== 'string') return ''
  const safe = value.slice(0, max * 8).replace(UNSAFE, '').replace(LOOSE_TAGS, '').replace(STACKED_MARKS, '$1')
  const parts = graphemes(safe)
  return (parts.length > max ? parts.slice(0, max).join('') : safe).trim()
}

/** Every file the plugin writes carries this, so a write never lands on a file that isn't ours. */
export const MARKER = 'codeCity'
export type FileKind = 'city' | 'ledger' | 'lease' | 'presence'
export const stamp = (kind: FileKind, data: object) => JSON.stringify({ [MARKER]: `${kind}/1`, ...data })

const LEGACY_KEYS: Record<FileKind, string[]> = {
  city: [],
  ledger: ['tokens', 'bricks', 'citizens', 'power', 'parks', 'edits', 'prompts', 'commands', 'fireworksUntil', 'rainbowUntil', 'showerUntil', 'purchases'],
  lease: ['id', 'until'],
  presence: ['id', 'slug', 'project', 'cwd', 'isBusy', 'tier', 'skyline', 'agents'],
}

/**
 * Whether parsed file contents are ours of this kind: stamped with the marker, or written before the marker
 * existed and holding exactly our fields (a city must have its buildings list).
 */
export function isOurFile(kind: FileKind, raw: unknown): boolean {
  if (!isRecord(raw)) return false
  if (raw[MARKER] !== undefined) return raw[MARKER] === `${kind}/1`
  const keys = Object.keys(raw)
  if (kind === 'city') return Array.isArray(raw.buildings)
  return keys.length > 0 && keys.every(k => LEGACY_KEYS[kind].includes(k))
}

/** A finite number within [lo, hi], or the fallback. */
export function num(value: unknown, lo: number, hi: number, fallback = lo): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(hi, Math.max(lo, value)) : fallback
}

const whole = (value: unknown, lo: number, hi: number, fallback = lo) => Math.round(num(value, lo, hi, fallback))

const itemIds = (value: unknown, allowed: Set<string>): ItemId[] =>
  Array.isArray(value) ? [...new Set(value.filter((v): v is ItemId => typeof v === 'string' && allowed.has(v)))] : []

function building(raw: unknown): Building | undefined {
  if (!isRecord(raw)) return undefined
  const kind = KINDS.includes(raw.kind as Kind) ? (raw.kind as Kind) : 'house'
  const special = typeof raw.special === 'string' && LANDMARK_ITEMS.has(raw.special) ? (raw.special as ItemId) : undefined
  if (kind === 'special' && !special) return undefined
  return {
    id: whole(raw.id, 0, 1e9),
    x: whole(raw.x, 0, WORLD * 4),
    w: whole(raw.w, 1, 24, 5),
    kind,
    floors: whole(raw.floors, 0, MAX_FLOORS),
    target: whole(raw.target, 0, MAX_FLOORS),
    hue: whole(raw.hue, 0, 2),
    ...(special ? { special } : {}),
  }
}

export function sanitizeLedger(raw: unknown): Ledger | undefined {
  if (!isRecord(raw)) return undefined
  return {
    tokens: num(raw.tokens, 0, BIG),
    bricks: num(raw.bricks, 0, BIG),
    citizens: num(raw.citizens, 0, BIG),
    power: num(raw.power, 0, BIG),
    parks: num(raw.parks, 0, BIG),
    edits: num(raw.edits, 0, BIG),
    prompts: num(raw.prompts, 0, BIG),
    commands: num(raw.commands, 0, BIG),
    fireworksUntil: num(raw.fireworksUntil, 0, BIG),
    rainbowUntil: num(raw.rainbowUntil, 0, BIG),
    showerUntil: num(raw.showerUntil, 0, BIG),
    purchases: itemIds(raw.purchases, ITEMS),
  }
}

/** A city read from disk or the store, every field checked and every number clamped. */
export function sanitizeCity(raw: unknown): City | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.buildings)) return undefined
  const buildings = raw.buildings
    .slice(0, MAX_BUILDINGS)
    .map(building)
    .filter((b): b is Building => b !== undefined)
  const sessions: [string, { ledger: Ledger; at: number }][] = []
  if (isRecord(raw.applied))
    for (const [session, entry] of Object.entries(raw.applied).slice(0, MAX_SESSIONS * 50)) {
      if (!/^[A-Za-z0-9-]{1,64}$/.test(session) || !isRecord(entry)) continue
      const l = sanitizeLedger(entry.ledger)
      if (l) sessions.push([session, { ledger: l, at: num(entry.at, 0, BIG) }])
    }
  // Keep the most recently active sessions: dropping a live one would re-count its earnings.
  const applied = Object.fromEntries(sessions.sort((a, b) => b[1].at - a[1].at).slice(0, MAX_SESSIONS))
  const tokens = num(raw.tokens, 0, BIG)
  const project = clean(raw.project, 48)
  return {
    founded: num(raw.founded, 0, BIG),
    bricks: num(raw.bricks, 0, BIG),
    citizens: num(raw.citizens, 0, 1e9),
    power: num(raw.power, 0, 1e9),
    parks: whole(raw.parks, 0, 1e4),
    edits: num(raw.edits, 0, BIG),
    prompts: num(raw.prompts, 0, BIG),
    commands: num(raw.commands, 0, BIG),
    nextId: whole(raw.nextId, 1, 1e9, buildings.reduce((m, b) => Math.max(m, b.id + 1), 1)),
    fireworksUntil: num(raw.fireworksUntil, 0, BIG),
    showerUntil: num(raw.showerUntil, 0, BIG),
    rainbowUntil: num(raw.rainbowUntil, 0, BIG),
    tunnel: num(raw.tunnel, 0, MAX_TUNNEL),
    tunnel2: num(raw.tunnel2, 0, MAX_TUNNEL),
    tokens,
    spent: num(raw.spent, 0, BIG),
    owned: itemIds(raw.owned, ITEMS),
    rev: whole(raw.rev, 0, BIG),
    ...(project ? { project } : {}),
    applied,
    buildings,
  }
}

function neighbourAgent(raw: unknown): NeighbourAgent | undefined {
  if (!isRecord(raw)) return undefined
  const status = STATUSES.includes(raw.status as string) ? (raw.status as string) : undefined
  const type = clean(raw.type, 32)
  return status && type ? { type, status } : undefined
}

/** Another session's presence file: only the fields the game draws. */
export function sanitizeNeighbour(raw: unknown): Neighbour | undefined {
  if (!isRecord(raw)) return undefined
  const id = clean(raw.id, 64)
  const slug = typeof raw.slug === 'string' && /^[A-Za-z0-9-]{1,140}$/.test(raw.slug) ? raw.slug : ''
  if (!id || !slug) return undefined
  return {
    id,
    slug,
    project: clean(raw.project, 48) || 'unknown',
    isBusy: raw.isBusy === true,
    tier: clean(raw.tier, 16),
    skyline: Array.isArray(raw.skyline) ? raw.skyline.slice(0, 60).map(h => whole(h, 0, MAX_FLOORS)) : [],
    agents: Array.isArray(raw.agents)
      ? raw.agents
          .slice(0, 12)
          .map(neighbourAgent)
          .filter((a): a is NeighbourAgent => a !== undefined)
      : [],
  }
}

/** A short, stable hash of a string as hex (FNV-1a, 32 bits). */
export function fnv(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16).padStart(8, '0')
}
