import type { Building, City, Kind, Scene } from '../types'
import { drawBuilding } from './buildings'
import { hash, hashStr, mix, PAVEMENT, STREET } from './pixels'
import {
  drawAurora,
  drawBolt,
  drawClouds,
  drawFog,
  drawPrecipitation,
  drawRainbow,
  drawSnowCover,
  drawStreetWeather,
  overcastTint,
  weatherAt,
} from './weather'
import { drawPeople } from './people'
import { itemOf, owns } from './shop'
import { drawHeavens, drawSkyline, drawStreetscape } from './specials'
import { depthOf, drawUnderground, entrancesOf, lengthsOf, SECOND_LINE_AT, stationsOf, SUBWAY_AT, TRAINS_AT } from './underground'

export { hash, hashStr, mix, stationsOf }

export const WORLD = 220
export const MAX_FLOORS = 14
const FLOOR_COST = 5
const LOT_COST = 12
const DIG_COST = 4
const WIDTHS: Record<Kind, [number, number]> = {
  house: [4, 6],
  shop: [5, 7],
  apartment: [6, 8],
  tower: [5, 9],
  factory: [8, 10],
  civic: [9, 11],
  landmark: [5, 6],
  park: [6, 10],
  special: [0, 0],
}

const TIERS: [number, string][] = [
  [500, 'Metropolis'],
  [200, 'City'],
  [80, 'Town'],
  [30, 'Village'],
  [10, 'Hamlet'],
  [0, 'Campsite'],
]

const MIX: [number, Partial<Record<Kind, number>>][] = [
  [200, { house: 12, shop: 20, apartment: 25, tower: 30, civic: 8, landmark: 5 }],
  [80, { house: 25, shop: 25, apartment: 25, tower: 15, civic: 7, landmark: 3 }],
  [30, { house: 45, shop: 30, apartment: 18, civic: 7 }],
  [0, { house: 70, shop: 30 }],
]

export const tierOf = (c: City) => TIERS.find(([min]) => c.citizens >= min)?.[1] ?? 'Campsite'

export const newCity = (now: number): City => ({
  founded: now,
  bricks: 15,
  citizens: 3,
  power: 0,
  parks: 0,
  edits: 0,
  prompts: 0,
  commands: 0,
  nextId: 2,
  fireworksUntil: 0,
  tunnel: 0,
  tunnel2: 0,
  buildings: [{ id: 1, x: 0, w: 5, kind: 'house', floors: 0, target: 1, hue: 0 }],
})

const rightEdge = (c: City) => c.buildings.reduce((m, b) => Math.max(m, b.x + b.w), 0)

function weighted(weights: Partial<Record<Kind, number>>, roll: number): Kind {
  const entries = Object.entries(weights) as [Kind, number][]
  const total = entries.reduce((n, [, w]) => n + w, 0)
  let left = roll * total
  for (const [kind, w] of entries) if ((left -= w) < 0) return kind
  return entries[0]?.[0] ?? 'house'
}

function pickKind(c: City, roll: number, reroll: number): Kind {
  if (c.parks > 0) return 'park'
  const factories = c.buildings.filter(b => b.kind === 'factory').length
  if (c.power >= 10 + factories * 12) return 'factory'
  const weights = MIX.find(([min]) => c.citizens >= min)?.[1] ?? { house: 1 }
  const kind = weighted(weights, roll)
  const last = c.buildings.at(-1)?.kind
  return kind === last && reroll < 0.6 ? weighted(weights, reroll) : kind
}

function startingFloors(kind: Kind, roll: number) {
  const ranges: Record<Kind, [number, number]> = {
    park: [0, 0],
    special: [1, 1],
    house: [1, 3],
    shop: [1, 4],
    apartment: [3, 7],
    tower: [5, 12],
    factory: [1, 4],
    civic: [2, 4],
    landmark: [6, 10],
  }
  const [lo, hi] = ranges[kind]
  return lo + Math.floor(roll * (hi - lo + 1))
}

const CAPS: Record<Kind, number> = {
  house: 3,
  shop: 6,
  apartment: 10,
  tower: 13,
  factory: 5,
  civic: 5,
  landmark: 0,
  park: 0,
  special: 0,
}

/** Each building's own height limit: its kind's, scaled between 55% and 125% by its id. */
export function capOf(b: Pick<Building, 'id' | 'kind'>) {
  const base = CAPS[b.kind]
  if (base === 0) return 0
  return Math.max(1, Math.min(MAX_FLOORS, Math.round(base * (0.55 + 0.7 * hash(b.id, 51)))))
}

function redevelop(c: City, b: Building, roll: number): Building {
  const cap = capOf(b)
  if (b.target < cap) return { ...b, target: Math.min(cap, b.target + 1 + Math.floor(hash(b.id, roll * 1000, 52) * 3)) }
  const { house: _, landmark: __, ...weights } = MIX.find(([min]) => c.citizens >= min)?.[1] ?? {}
  const kind = Object.keys(weights).length ? weighted(weights, roll) : 'shop'
  const target = Math.min(capOf({ id: b.id, kind }), Math.max(b.target + 1, startingFloors(kind, roll)))
  return { ...b, kind, floors: 0, target }
}

function dig(c: City): City {
  const reach = Math.max(rightEdge(c), 0)
  const [one = 0, two = 0] = lengthsOf(c)
  if (c.bricks < DIG_COST + FLOOR_COST) return c
  const step = owns(c, 'express') ? 6 : 3
  if (c.citizens >= SUBWAY_AT && one < reach) return { ...c, tunnel: Math.min(reach, one + step), bricks: c.bricks - DIG_COST }
  if (c.citizens >= SECOND_LINE_AT && two < reach) return { ...c, tunnel2: Math.min(reach, two + step), bricks: c.bricks - DIG_COST }
  return c
}

/** One idle tick: passive income, tunnelling, then spend bricks on the next floor or lot. */
export function tick(c: City, now: number): City {
  const income = Math.min(3, c.citizens * 0.015) * (owns(c, 'cityhall') ? 2 : 1)
  const next: City = dig({ ...c, bricks: c.bricks + income })
  const site = next.buildings.find(b => b.floors < b.target)

  if (site) {
    if (next.bricks < FLOOR_COST) return next
    next.bricks -= FLOOR_COST
    next.buildings = next.buildings.map(b => (b === site ? { ...b, floors: b.floors + 1 } : b))
    return next
  }

  if (next.bricks < LOT_COST) return next
  const roll = hash(next.nextId, now)
  const kind = pickKind(next, roll, hash(next.nextId, now, 2))
  const [lo, hi] = WIDTHS[kind]
  const w = lo + Math.floor(hash(next.nextId, 7) * (hi - lo + 1))
  const x = rightEdge(next) + (next.buildings.length ? 1 : 0)

  if (x + w <= WORLD) {
    next.bricks -= LOT_COST
    if (kind === 'park') next.parks -= 1
    if (kind === 'factory') next.power -= 10
    const cap = capOf({ id: next.nextId, kind })
    const start = startingFloors(kind, hash(next.nextId, 3))
    const target = cap ? Math.min(cap, start) : start
    next.buildings = [...next.buildings, { id: next.nextId, x, w, kind, floors: 0, target, hue: Math.floor(roll * 3) }]
    next.nextId += 1
    return next
  }

  const growable = next.buildings.filter(b => b.target < capOf(b))
  const pool = growable.length ? growable : next.buildings.filter(b => b.kind === 'house')
  const ranked = [...pool].sort((a, b) => a.target - b.target)
  const short = ranked[Math.floor(roll * roll * ranked.length)]
  if (!short) return next
  next.bricks -= LOT_COST
  next.buildings = next.buildings.map(b => (b === short ? redevelop(next, b, roll) : b))
  return next
}

const KIND_NAMES: Record<Kind, string> = {
  house: 'house',
  shop: 'shop',
  apartment: 'apartment block',
  tower: 'tower',
  factory: 'factory',
  civic: 'civic hall',
  landmark: 'landmark',
  park: 'park',
  special: 'landmark',
}
const nameOf = (b: Building) => (b.special ? (itemOf(b.special)?.name.toLowerCase() ?? 'landmark') : KIND_NAMES[b.kind])
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const article = (s: string) => `${/^[aeiou]/.test(s) ? 'an' : 'a'} ${s}`

/** What happened on the street between two states of the city, for the log. */
export function happenings(before: City, after: City): string[] {
  const old = new Map(before.buildings.map(b => [b.id, b]))
  const news: string[] = []
  for (const b of after.buildings) {
    const was = old.get(b.id)
    if (!was) news.push(b.kind === 'park' ? 'A new park is laid out' : `Work starts on ${article(nameOf(b))}`)
    else if (was.kind !== b.kind) news.push(`${capital(article(nameOf(was)))} is redeveloped into ${article(nameOf(b))}`)
    else if (b.target > was.target) news.push(`${capital(nameOf(b))} gets ${b.target - was.target} more ${b.target - was.target === 1 ? 'floor' : 'floors'}`)
    else if (was.floors < was.target && b.floors >= b.target && b.kind !== 'park')
      news.push(b.special ? `${capital(nameOf(b))} opens` : `${capital(nameOf(b))} finished at ${b.floors} ${b.floors === 1 ? 'floor' : 'floors'}`)
  }
  return news
}

/** Announcements earned between two states of the city. */
export function milestones(before: City, after: City): string[] {
  const [b1 = 0, b2 = 0] = lengthsOf(before)
  const [a1 = 0, a2 = 0] = lengthsOf(after)
  const news: string[] = []
  if (tierOf(before) !== tierOf(after)) news.push(`Your settlement is now a ${tierOf(after)}!`)
  if (b1 === 0 && a1 > 0) news.push('Ground broken on the Red Line subway!')
  if (b1 < TRAINS_AT && a1 >= TRAINS_AT) news.push('The first Red Line train is running!')
  if (b2 === 0 && a2 > 0) news.push('Digging begins on the Blue Line!')
  if (b2 < TRAINS_AT && a2 >= TRAINS_AT) news.push('Blue Line trains are in service!')
  if (stationsOf(after) > stationsOf(before)) news.push(`Station ${stationsOf(after)} opens`)
  return news
}

const DAY_MS = 240_000
const NO_SCENE: Scene = { agents: [], neighbours: [] }

const AGENT_COLORS = [0xff6b6b, 0x4ecdc4, 0xffd93d, 0xc77dff, 0x6bcb77, 0xff9f43, 0x54a0ff]
export const agentColor = (type: string) => AGENT_COLORS[Math.floor(hashStr(type) * AGENT_COLORS.length)] ?? 0xffffff
export const hex = (col: number) => `#${col.toString(16).padStart(6, '0')}`

export function skyAt(now: number) {
  const phase = (now % DAY_MS) / DAY_MS
  const elev = Math.sin(phase * Math.PI * 2)
  const light = Math.max(0, Math.min(1, elev * 2.5 + 0.35))
  return { phase, light, dusk: Math.max(0, 1 - Math.abs(elev) * 4), isNight: light < 0.4 }
}

/** Paints the scene into a W×H pixel grid of 0xRRGGBB. */
export function paint(c: City, W: number, H: number, now: number, scene: Scene = NO_SCENE): Uint32Array {
  const px = new Uint32Array(W * H)
  const set = (x: number, y: number, col: number) => {
    if (x >= 0 && x < W && y >= 0 && y < H) px[y * W + x] = col
  }
  const get = (x: number, y: number) => px[y * W + x] ?? 0
  const depth = depthOf(c, H)
  const ground = H - STREET - depth

  const { phase, light, dusk, isNight } = skyAt(now)
  const w = weatherAt(now, c)
  const isDark = isNight || w.overcast > 0.6
  const sky = { W, ground, now, light, isNight, set, get }
  const roofTop = new Int16Array(W).fill(H)
  const solid = (x: number, y: number, col: number) => {
    set(x, y, col)
    if (x >= 0 && x < W && y >= 0 && y < (roofTop[x] ?? H)) roofTop[x] = y
  }

  const top = overcastTint(mix(0x070b1f, 0x4a9fe0, light), w, light)
  const bottom = overcastTint(mix(mix(0x1a2240, 0xa8dcf5, light), 0xf08a4b, dusk * 0.75), w, light)
  for (let y = 0; y < ground; y++) {
    const row = mix(top, bottom, y / ground)
    for (let x = 0; x < W; x++) set(x, y, row)
  }

  if (light < 0.6 && w.overcast < 0.6) {
    for (let y = 0; y < ground - 4; y++)
      for (let x = 0; x < W; x++)
        if (hash(x, y, 7) > 0.982) {
          const twinkle = 0.5 + 0.5 * hash(x, y, Math.floor(now / 700))
          set(x, y, mix(get(x, y), 0xffffff, (1 - light / 0.6) * twinkle * (1 - w.overcast / 0.6)))
        }
  }
  drawAurora(sky, w)

  const orb = (p: number, col: number) => {
    const ox = Math.round(p * (W + 6)) - 3
    const oy = Math.round(ground - Math.sin(p * Math.PI) * (ground - 3))
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const corner = dx !== 0 && dy !== 0
        if (oy + dy < ground) set(ox + dx, oy + dy, mix(get(ox + dx, oy + dy), col, (corner ? 0.45 : 1) * (1 - w.overcast)))
      }
  }
  if (phase < 0.5) orb(phase * 2, mix(0xffb347, 0xfff3b0, light))
  else orb((phase - 0.5) * 2, 0xe8ecf5)
  drawRainbow(sky, w)
  const moonP = (phase - 0.5) * 2
  const moon = phase >= 0.5 ? { x: Math.round(moonP * (W + 6)) - 3, y: Math.round(ground - Math.sin(moonP * Math.PI) * (ground - 3)) } : undefined
  const sunP = phase * 2
  const sun = phase < 0.5 ? { x: Math.round(sunP * (W + 6)) - 3, y: Math.round(ground - Math.sin(sunP * Math.PI) * (ground - 3)) } : undefined
  drawHeavens({ W, set, fx: set, get, shade: (col: number) => col, isNight, now, ground }, c, light, moon, sun)
  drawClouds(sky, w)
  drawBolt(sky, w)

  const hill = mix(0x141c30, 0x6f9c7a, light)
  for (let x = 0; x < W; x++) {
    const hh = Math.round(3 + 2.5 * Math.sin(x / 9) + 1.5 * Math.sin(x / 4.3 + 1))
    for (let y = ground - hh; y < ground; y++) solid(x, y, mix(hill, get(x, y), 0.25))
  }

  const districts = scene.neighbours.slice(0, 4)
  const slot = districts.length ? Math.floor(W / districts.length) : 0
  const haze = mix(0x2a3550, 0x8fa8c0, light)
  districts.forEach((n, i) => {
    const heights = (n.skyline.length ? n.skyline : [1]).slice(0, Math.floor((slot - 4) / 3))
    const width = heights.length * 3 - 1
    const x0 = i * slot + Math.floor((slot - width) / 2)
    const base = ground - Math.max(3, Math.round(ground * 0.28))
    const glow = agentColor(n.project)
    for (let x = x0 - 4; x < x0 + width + 4; x++) {
      const edge = Math.min(x - (x0 - 4), x0 + width + 3 - x)
      for (let y = base + 1 + Math.max(0, 3 - edge); y < ground; y++) solid(x, y, mix(hill, haze, 0.2))
    }
    let peak = { x: x0, y: base }
    heights.forEach((f, k) => {
      const h = Math.min(Math.floor(base * 0.6), 2 + Math.round(f * 0.8))
      for (let x = x0 + k * 3; x < x0 + k * 3 + 2; x++)
        for (let y = base; y > base - h; y--) {
          const flicker = hash(n.id.length, x, y, Math.floor(now / 350))
          const isLit = n.isBusy ? flicker > 0.55 : isDark && hash(x, y) > 0.8
          solid(x, y, isLit ? mix(0xffd27a, haze, n.isBusy ? 0 : 0.5) : haze)
        }
      if (base - h < peak.y) peak = { x: x0 + k * 3, y: base - h }
    })
    const isBlink = !n.isBusy || Math.floor(now / 500) % 2 === 0
    set(peak.x, peak.y - 1, isBlink ? glow : haze)
    n.agents.forEach((a, k) => {
      const ax = x0 + Math.round((hash(k, 11) * width + now / 400) % Math.max(1, width))
      const ay = peak.y - 3 - Math.round(hash(k, 12) * 3 + Math.sin(now / 300 + k))
      if (ay >= 0) set(ax, ay, Math.floor(now / 250 + k) % 2 ? agentColor(a.type) : 0xffffff)
    })
  })

  const used = Math.max(rightEdge(c), ...lengthsOf(c))
  let off: number
  if (used <= W) off = Math.floor((W - used) / 2)
  else {
    const span = used - W
    const t = (now / 220) % (span * 2)
    off = -Math.round(t < span ? t : span * 2 - t)
  }

  const shade = (col: number) => mix(col, 0x0a0d18, (isNight ? 0.55 : (1 - light) * 0.4) + w.overcast * 0.2)
  const cv = { W, set: solid, fx: set, get, shade, isNight: isDark, now, ground }
  for (const b of c.buildings) drawBuilding(cv, b, b.x + off)
  drawSnowCover(sky, w, roofTop, shade)
  drawSkyline(cv, c, off)

  scene.agents.forEach((a, k) => {
    const isWorking = a.status === 'running' || a.status === 'pending'
    const seed = hashStr(a.id)
    const span = Math.max(1, W - 4)
    const travel = (seed * span * 2 + (now / 1000) * (isWorking ? 9 : 0.6)) % (span * 2)
    const x = 2 + Math.round(travel < span ? travel : span * 2 - travel)
    const y = 2 + Math.round(hash(k, 21) * (ground / 2.5) + Math.sin(now / 280 + k) * (isWorking ? 1 : 0.5))
    const col = agentColor(a.type)
    const rotor = Math.floor(now / 120) % 2 ? 0xd0d4dc : 0x8a8f98
    set(x - 1, y, rotor)
    set(x + 1, y, rotor)
    set(x, y, isWorking && Math.floor(now / 300) % 2 ? 0xffffff : col)
    if (isWorking) set(x, y + 1, 0x9a5a2a)
  })

  const walk = shade(0x8a8f98)
  for (let x = 0; x < W; x++) {
    set(x, ground, x % 4 === 0 ? mix(walk, 0x000000, 0.12) : mix(walk, 0xffffff, 0.06))
    set(x, ground + 1, walk)
    set(x, ground + 2, shade(0x6a6f78))
    set(x, ground + PAVEMENT, 0x2b2d33)
    set(x, ground + PAVEMENT + 1, 0x24262b)
  }
  drawStreetWeather(sky, w)
  drawStreetscape(cv, c, off, w.season)
  drawPeople({ W, ground, now, isNight, shade, set }, c, w, depth > 0 ? entrancesOf(c) : [], off)
  if (depth > 0) drawUnderground(cv, c, off, depth, rightEdge(c))
  const cars = Math.min(14, 1 + Math.floor(c.citizens / 12))
  for (let i = 0; i < cars; i++) {
    const right = i % 2 === 0
    const speed = 6 + hash(i, 3) * 10
    const loop = W + 8
    const pos = (hash(i, 9) * loop + (now / 1000) * speed) % loop
    const x = Math.round(right ? pos - 4 : W + 3 - pos)
    const y = right ? ground + PAVEMENT : ground + PAVEMENT + 1
    const body = [0xd94040, 0x3f7fd9, 0xf2d24a, 0xf2f2f2, 0x40b070][Math.floor(hash(i, 5) * 5)] ?? 0xd94040
    const front = isDark ? 0xfff4b0 : body
    const back = isDark ? 0xff3030 : body
    set(x, y, right ? back : front)
    set(x + 1, y, body)
    set(x + 2, y, right ? front : back)
  }
  drawFog(sky, w)
  drawPrecipitation(sky, w)

  if (now < c.fireworksUntil) {
    for (let k = 0; k < 3; k++) {
      const slot = Math.floor(now / 1400) + k * 31
      const age = ((now + k * 450) % 1400) / 1400
      const cx = Math.round(hash(slot, 1) * W)
      const cy = 2 + Math.round(hash(slot, 2) * (ground / 2))
      const col = [0xff5a5a, 0x5affc8, 0xffe14a, 0xc86bff][Math.floor(hash(slot, 3) * 4)] ?? 0xff5a5a
      const r = 1 + age * 6
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2
        const fx = Math.round(cx + Math.cos(ang) * r)
        const fy = Math.round(cy + Math.sin(ang) * r * 0.6)
        if (fy < ground) set(fx, fy, mix(col, get(Math.max(0, Math.min(W - 1, fx)), Math.max(0, fy)), age * age))
      }
    }
  }

  return px
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function base64(bytes: Uint8Array) {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63)
    out += i + 1 < bytes.length ? B64.charAt((n >> 6) & 63) : '='
    out += i + 2 < bytes.length ? B64.charAt(n & 63) : '='
  }
  return out
}

export function frame(c: City, columns: number, rows: number, now: number, scene: Scene = NO_SCENE) {
  return pack(paint(c, columns, rows * 2, now, scene), columns, rows)
}

/** Packs two pixel rows per terminal cell with an upper-half block. */
export function pack(px: Uint32Array, columns: number, rows: number) {
  const words = new Uint32Array(columns * rows * 3)
  for (let r = 0; r < rows; r++)
    for (let x = 0; x < columns; x++) {
      const i = (r * columns + x) * 3
      words[i] = 0x2580
      words[i + 1] = px[2 * r * columns + x] ?? 0
      words[i + 2] = px[(2 * r + 1) * columns + x] ?? 0
    }
  return base64(new Uint8Array(words.buffer))
}
