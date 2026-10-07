import type { City, Ledger } from '../types'
import { buy } from './shop'

export const LEASE_MS = 8_000
export const LEDGER_FRESH_MS = 6 * 3_600_000
const APPLIED_KEEP_MS = 7 * 86_400_000

const COUNTS = ['tokens', 'bricks', 'citizens', 'power', 'parks', 'edits', 'prompts', 'commands'] as const
const MOMENTS = ['fireworksUntil', 'rainbowUntil', 'showerUntil'] as const

export const emptyLedger = (): Ledger => ({
  tokens: 0,
  bricks: 0,
  citizens: 0,
  power: 0,
  parks: 0,
  edits: 0,
  prompts: 0,
  commands: 0,
  fireworksUntil: 0,
  rainbowUntil: 0,
  showerUntil: 0,
  purchases: [],
})

/** Folds what a session has earned since the city last heard from it into the city. */
export function applyLedger(c: City, session: string, ledger: Ledger, now: number): City {
  const seen = c.applied?.[session]?.ledger ?? emptyLedger()
  let next: City = { ...c }
  for (const key of COUNTS) next[key] = (next[key] ?? 0) + Math.max(0, ledger[key] - seen[key])
  for (const key of MOMENTS) next[key] = Math.max(next[key] ?? 0, ledger[key])
  for (const id of ledger.purchases.slice(seen.purchases.length)) next = buy(next, id).city ?? next
  // What has been counted only ever grows, so an older copy of a ledger read late can't be paid out twice.
  const counted: Ledger = { ...ledger, purchases: ledger.purchases.length >= seen.purchases.length ? ledger.purchases : seen.purchases }
  for (const key of [...COUNTS, ...MOMENTS]) counted[key] = Math.max(seen[key], ledger[key])
  return { ...next, applied: { ...c.applied, [session]: { ledger: counted, at: now } } }
}

export function pruneApplied(c: City, now: number): City {
  // Entries dated ahead of now come from a skewed clock or a hand edit; they'd hold a slot forever.
  const kept = Object.entries(c.applied ?? {}).filter(([, a]) => now - a.at < APPLIED_KEEP_MS && a.at <= now + 60_000)
  return { ...c, applied: Object.fromEntries(kept) }
}

export type Lease = { id: string; until: number }

/** One election round: whether to write a fresh lease, and whether this session runs the city now. */
export function contest(lease: Lease | undefined, self: string, now: number) {
  // A lease claiming more than one renewal ahead is forged or from a skewed clock: treat it as lapsed.
  const isHeld = lease !== undefined && lease.until >= now && lease.until <= now + LEASE_MS + 2_000
  const isOpen = !isHeld || lease.id === self
  return {
    write: isOpen ? { id: self, until: now + LEASE_MS } : undefined,
    isMayor: isHeld && lease.id === self,
  }
}

export const slugOf = (cwd: string) =>
  cwd
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-120) || 'root'
