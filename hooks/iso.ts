import type { Building, City, District, Kind } from '../types'
import { agentColor, skyAt } from './city'
import { hash, mix } from './pixels'
import { drawFog, drawPrecipitation, weatherAt } from './weather'

type Canvas = {
  W: number
  H: number
  set: (x: number, y: number, col: number) => void
  get: (x: number, y: number) => number
  shade: (col: number) => number
  now: number
  isDark: boolean
  snow: number
}

const FACE: Record<Kind, number[]> = {
  house: [0xd9b38c, 0xe0c9a6, 0xa9c4d9, 0xe6b8b8],
  shop: [0x6d8fb3, 0xb3706d, 0x7fa86a, 0xd9a441],
  apartment: [0xa0522d, 0xb5651d, 0x9c6b5a],
  tower: [0x55657a, 0x46536a, 0x67788f, 0x3d5a6b],
  factory: [0x7a6a5a, 0x6b6460],
  civic: [0xeae2d0, 0xd8d0c0],
  landmark: [0xc8b07a, 0xb08060],
  park: [0x4f9a4a],
  special: [0xb8c0cc],
}
const ROOF: Record<Kind, number> = {
  house: 0xa3442f,
  shop: 0x4a4a52,
  apartment: 0x5a4a40,
  tower: 0x39465a,
  factory: 0x5a4e44,
  civic: 0x5fa89a,
  landmark: 0xd4af37,
  park: 0x3f8a3a,
  special: 0x9aa4b2,
}
const SPECIAL: Partial<Record<string, { face: number; roof: number; floors: number }>> = {
  plaza: { face: 0xc8c0b0, roof: 0xd8d0c0, floors: 0 },
  ferris: { face: 0x9aa4b2, roof: 0x9aa4b2, floors: 1 },
  stadium: { face: 0x8a909c, roof: 0x4f9a4a, floors: 2 },
  needle: { face: 0xc8ccd4, roof: 0xd8dce4, floors: 16 },
  rocket: { face: 0xf2f2f2, roof: 0xd94040, floors: 7 },
  biodome: { face: 0x8fd8e8, roof: 0xbfeef6, floors: 3 },
  supertall: { face: 0x5a6a80, roof: 0xd8dce4, floors: 22 },
  elevator: { face: 0x8a96a8, roof: 0xe8ecf0, floors: 2 },
}
const SLAB = 2
const TUCK = 3

const pick = (list: number[] | undefined, roll: number) => list?.[Math.floor(roll * list.length)] ?? 0x888888

/** A 2:1 isometric prism: a diamond footprint `width` wide whose top vertex is (sx, sy), raised `h` pixels. */
function prism(cv: Canvas, sx: number, sy: number, width: number, h: number, left: number, right: number, top: number) {
  const half = width / 2
  for (let x = sx - half; x < sx + half; x++) {
    const d = x < sx ? sx - 1 - x : x - sx
    const yTop = sy + Math.floor(d / 2)
    const yBot = sy + half - 1 - Math.floor(d / 2)
    for (let y = yTop - h; y < yBot - h; y++) cv.set(x, y, top)
    for (let y = Math.max(yBot - h, yTop - h); y <= yBot; y++) cv.set(x, y, x < sx ? left : right)
  }
}

function windowsOn(cv: Canvas, b: Building, sx: number, sy: number, width: number, h: number, isGlass: boolean) {
  const half = width / 2
  for (let x = sx - half + 1; x < sx + half - 1; x++) {
    if (!isGlass && x % 2 !== 0) continue
    const d = x < sx ? sx - 1 - x : x - sx
    const yBot = sy + half - 1 - Math.floor(d / 2)
    for (let y = yBot - h + 1; y < yBot - 1; y += 2) {
      const lit = cv.isDark
        ? hash(b.id, x - sx, y - sy, Math.floor(cv.now / 9000)) > 0.45
          ? 0xffd27a
          : 0x262b3a
        : mix(0x9fd3f5, 0xffffff, hash(b.id, x, y) * 0.3)
      cv.set(x, y, lit)
    }
  }
}

function drawBuilding(cv: Canvas, b: Building, sx: number, sy: number, T: number) {
  const { shade, now } = cv
  const roll = hash(b.id, 100)
  const perFloor = T / 4
  const snowy = (col: number) => mix(col, 0xf4f8ff, cv.snow * 0.85)
  const footprint = (b.kind === 'house' || b.kind === 'landmark') && T >= 8 ? T - 4 : T
  const fx = sx
  const fy = sy + (T - footprint) / 4

  if (b.kind === 'park') {
    prism(cv, sx, sy, T, 0, shade(0x3f7a3a), shade(0x4f9a4a), shade(snowy(0x4f9a4a)))
    const tree = shade(snowy(hash(b.id, 7) > 0.5 ? 0x2f7d3a : 0x1f5f3a))
    cv.set(sx - 1, sy + T / 4 - 1, tree)
    cv.set(sx - 1, sy + T / 4 - 2, tree)
    if (T >= 6) cv.set(sx, sy + T / 4 - 1, tree)
    return
  }

  const special = b.special ? SPECIAL[b.special] : undefined
  const face = special?.face ?? pick(FACE[b.kind], roll)
  const roofCol = special?.roof ?? ROOF[b.kind]
  const floors = special ? (b.floors < b.target ? b.floors : special.floors) : b.floors
  const h = Math.min(Math.round(cv.H * 0.7), Math.max(b.floors > 0 ? 1 : 0, Math.round(floors * perFloor)))
  prism(cv, fx, fy, footprint, h, shade(mix(face, 0x000000, 0.28)), shade(face), shade(snowy(roofCol)))
  if (b.kind !== 'special' && h >= 2) windowsOn(cv, b, fx, fy, footprint, h, b.kind === 'tower')

  const peak = fy - h
  if (b.kind === 'house' && h > 0) {
    cv.set(fx - 1, peak - 1, shade(snowy(roofCol)))
    cv.set(fx, peak - 1, shade(snowy(roofCol)))
  } else if (b.kind === 'tower' && h > 0) {
    cv.set(fx, peak - 1, shade(0x9aa4b2))
    cv.set(fx, peak - 2, cv.isDark && Math.floor(now / 800) % 2 ? 0xff3030 : shade(0x9aa4b2))
  } else if (b.kind === 'factory' && h > 0) {
    for (let y = peak; y > peak - 3; y--) cv.set(fx + 1, y, shade(0x8a3b2b))
    const rise = (now / 400) % 5
    cv.set(fx + 1 + Math.round(rise / 2), Math.round(peak - 3 - rise), mix(cv.get(Math.max(0, fx + 1), Math.max(0, peak - 3)), 0xc8c8c8, 0.6))
  } else if (b.special === 'ferris') {
    const r = Math.max(2, T / 2)
    const cy = peak - r
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2 + now / 6000
      const col = cv.isDark && a % 2 ? [0xff4fd8, 0x4ff0ff, 0xfff04f][a % 3]! : shade(0xe8e8e8)
      cv.set(Math.round(fx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r * 0.9), col)
    }
  } else if (b.special === 'elevator') {
    for (let y = peak - 1; y >= 0; y--) cv.set(fx, y, mix(cv.get(fx, y), 0xe8ecf0, 0.7))
    const trip = (now / 1000) % 40
    cv.set(fx, Math.round(peak - 2 - (trip < 20 ? trip / 20 : 2 - trip / 20) * (peak - 3)), 0x7fd8ff)
  } else if (b.special === 'rocket') {
    cv.set(fx, peak - 1, shade(0xd94040))
  } else if (b.special === 'supertall' || b.special === 'needle') {
    cv.set(fx, peak - 1, shade(0xc8ccd4))
    cv.set(fx, peak - 2, cv.isDark && Math.floor(now / 700) % 2 ? 0xff3030 : shade(0xc8ccd4))
    if (b.special === 'supertall' && cv.isDark) cv.set(fx - 1, peak, [0xff4fd8, 0x4ff0ff, 0xfff04f][Math.floor(now / 1500) % 3]!)
  }

  if (b.floors < b.target) {
    const top = fy - Math.round(b.target * perFloor) - 2
    const mast = fx + footprint / 2 - 1
    for (let y = fy + T / 4; y >= top; y--) cv.set(mast, y, 0xf2b33d)
    for (let x = mast - T / 2; x <= mast + 1; x++) cv.set(x, top, 0xf2b33d)
    cv.set(mast - Math.floor(T / 4), top + 1 + Math.round((Math.sin(now / 700) + 1) * 1.5), 0x9a5a2a)
  }
}

/** Plot positions inside the ring road, nearest the back corner first. */
function plotsFor(n: number) {
  const m = Math.max(2, Math.ceil(Math.sqrt(n)))
  const plots: { gx: number; gy: number }[] = []
  for (let gy = 0; gy < m; gy++) for (let gx = 0; gx < m; gx++) plots.push({ gx: gx + 1, gy: gy + 1 })
  return { size: m + 2, plots }
}

function ringTile(size: number, i: number) {
  const side = size - 1
  const k = ((i % (side * 4)) + side * 4) % (side * 4)
  if (k < side) return { gx: k, gy: 0 }
  if (k < side * 2) return { gx: side, gy: k - side }
  if (k < side * 3) return { gx: side - (k - side * 2), gy: side }
  return { gx: 0, gy: side - (k - side * 3) }
}

const tallest = (c: City, T: number) =>
  c.buildings.reduce((m, b) => Math.max(m, Math.round(Math.max(b.target, (b.special && SPECIAL[b.special]?.floors) || 0) * (T / 4))), 0)

type Placed = { d: District; size: number; left: number; baseline: number; row: number; T: number }

/** Tile widths from nearest to farthest; the closest that fits is zoom 0. */
export const TILES = [8, 6, 4, 2]
export const ZOOMS = 3

/** Islands in rows at tile width T: the first city front and centre, the rest in rows behind. */
function arrange(districts: District[], sizes: number[], W: number, H: number, T: number) {
  const gap = T
  const rows: number[][] = []
  sizes.forEach((size, i) => {
    const row = rows.at(-1)
    const width = row ? row.reduce((n, k) => n + sizes[k]! * T + gap, 0) + size * T : Infinity
    if (row && width <= W - 2) row.push(i)
    else rows.push([i])
  })
  const depth = (row: number[]) => Math.max(...row.map(k => (sizes[k]! * T) / 2))
  const widest = Math.max(0, ...rows.map(row => row.reduce((n, k) => n + sizes[k]! * T, 0) + gap * (row.length - 1)))
  const back = rows.at(-1) ?? []
  const headroom = Math.max(0, ...back.map(k => tallest(districts[k]!.city, T))) + 2
  const height = rows.reduce((n, row) => n + depth(row) - TUCK, TUCK) + SLAB + headroom

  const placed: Placed[] = []
  let baseline = H - 2 - Math.max(0, Math.floor((H - height) / 2))
  rows.forEach((row, r) => {
    const width = row.reduce((n, k) => n + sizes[k]! * T, 0) + gap * (row.length - 1)
    let left = Math.max(1, Math.floor((W - width) / 2))
    for (const k of row) {
      placed.push({ d: districts[k]!, size: sizes[k]!, left, baseline, row: r, T })
      left += sizes[k]! * T + gap
    }
    baseline -= depth(row) - TUCK
  })
  return { placed, T, width: widest, fits: widest <= W - 2 && height <= H }
}

/** The map at a zoom level: 0 is the largest tile that fits, each step one size smaller. */
export function layout(districts: District[], W: number, H: number, zoom = 0) {
  const sizes = districts.map(d => plotsFor(d.city.buildings.length).size)
  const near = TILES.slice(0, -1).findIndex(T => arrange(districts, sizes, W, H, T).fits)
  const fit = near === -1 ? TILES.length - 2 : near
  const T = TILES[Math.min(TILES.length - 1, fit + Math.max(0, zoom))]!
  return arrange(districts, sizes, W, H, T)
}

/** The whole region: every city as an island in a shared sea. */
export function paintRegion(districts: District[], W: number, H: number, now: number, zoom = 0): Uint32Array {
  const px = new Uint32Array(W * H)
  const set = (x: number, y: number, col: number) => {
    const [xi, yi] = [Math.floor(x), Math.floor(y)]
    if (xi >= 0 && xi < W && yi >= 0 && yi < H) px[yi * W + xi] = col
  }
  const get = (x: number, y: number) => px[Math.floor(y) * W + Math.floor(x)] ?? 0
  const here = districts.find(d => d.isHere) ?? districts[0]
  const { light, isNight } = skyAt(now)
  const w = here ? weatherAt(now, here.city) : undefined
  const overcast = w?.overcast ?? 0
  const isDark = isNight || overcast > 0.6
  const shade = (col: number) => mix(col, 0x0a0d18, (isNight ? 0.55 : (1 - light) * 0.4) + overcast * 0.2)
  const cv: Canvas = { W, H, set, get, shade, now, isDark, snow: w?.snow ?? 0 }

  const shallow = shade(mix(0x2f6f9f, 0x4f9fd0, light))
  const deep = shade(mix(0x123050, 0x2a6aa0, light))
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const base = mix(deep, shallow, y / H)
      set(x, y, hash(x >> 1, y, Math.floor(now / 700)) > 0.94 ? mix(base, 0xffffff, 0.2 + light * 0.2) : base)
    }

  const { placed, T, width } = layout(districts, W, H, zoom)
  let pan = 0
  if (width > W - 2) {
    const span = width - W + 4
    const t = (now / 250) % (span * 2)
    pan = Math.round(t < span ? t : span * 2 - t)
  }
  const anchors = placed
    .map(p => {
      const full = p.size * T
      return { p, sx: p.left - pan + full / 2, sy: p.baseline - full / 2 + 1, full }
    })
    .sort((a, b) => b.p.row - a.p.row || a.p.left - b.p.left)

  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1]!
    const b = anchors[i]!
    if (a.p.row !== b.p.row) continue
    const from = { x: a.sx + a.full / 2, y: a.sy + a.full / 4 - SLAB }
    const to = { x: b.sx - b.full / 2, y: b.sy + b.full / 4 - SLAB }
    for (let x = from.x; x <= to.x; x++) {
      const y = Math.round(from.y + ((to.y - from.y) * (x - from.x)) / Math.max(1, to.x - from.x))
      set(x, y, shade(0x8a8f98))
      set(x, y + 1, shade(0x5a5f68))
    }
  }

  for (const { p, sx, sy, full } of anchors) {
    const { d, size } = p
    prism(cv, sx, sy, full, SLAB, shade(0x6a4a30), shade(0x8a6040), shade(0x6f8f5a))
    const tileAt = (gx: number, gy: number) => ({ x: sx + ((gx - gy) * T) / 2, y: sy - SLAB + ((gx + gy) * T) / 4 })

    for (let gy = 0; gy < size; gy++)
      for (let gx = 0; gx < size; gx++) {
        const isRoad = gx === 0 || gy === 0 || gx === size - 1 || gy === size - 1
        if (!isRoad) continue
        const t = tileAt(gx, gy)
        prism(cv, t.x, t.y, T, 0, shade(0x3a3c44), shade(0x3a3c44), shade(mix(0x3a3c44, 0xf4f8ff, cv.snow * 0.5)))
      }

    const { plots } = plotsFor(d.city.buildings.length)
    const order = d.city.buildings
      .map((b, i) => ({ b, plot: plots[i]! }))
      .sort((a, b) => a.plot.gx + a.plot.gy - (b.plot.gx + b.plot.gy) || a.plot.gx - b.plot.gx)
    for (const { b, plot } of order) {
      const t = tileAt(plot.gx, plot.gy)
      drawBuilding(cv, b, t.x, t.y, T)
    }

    const ringLen = (size - 1) * 4
    const cars = Math.min(6, 1 + Math.floor(d.city.citizens / 20))
    for (let k = 0; k < cars; k++) {
      const pos = (hash(k, 9) * ringLen + (now / 1000) * (0.8 + hash(k, 3))) % ringLen
      const tile = ringTile(size, Math.floor(pos))
      const t = tileAt(tile.gx, tile.gy)
      const body = [0xd94040, 0x3f7fd9, 0xf2d24a, 0xf2f2f2][k % 4]!
      set(t.x - 1, t.y + T / 4 - 1, isDark ? 0xfff4b0 : body)
    }

    const glow = agentColor(d.name)
    const flagX = sx - full / 2 + 1
    const flagY = sy + full / 4 - SLAB - 1
    for (let y = flagY; y > flagY - 4; y--) set(flagX, y, shade(0xd8dce4))
    const isBlink = !d.isBusy || Math.floor(now / 500) % 2 === 0
    set(flagX + 1, flagY - 3, isBlink ? glow : shade(glow))
    set(flagX + 2, flagY - 3 + (Math.floor(now / 600) % 2), isBlink ? glow : shade(glow))
    if (d.isHere) set(flagX, flagY - 4, 0xffffff)

    d.agents.forEach((a, k) => {
      const span = Math.max(2, full - 4)
      const travel = (hash(k, 31) * span * 2 + (now / 1000) * (a.status === 'running' ? 6 : 0.5)) % (span * 2)
      const x = Math.round(sx - full / 2 + 2 + (travel < span ? travel : span * 2 - travel))
      const y = Math.round(sy - SLAB - 6 - hash(k, 32) * 4 + Math.sin(now / 280 + k))
      set(x - 1, y, 0xb0b8c4)
      set(x + 1, y, 0xb0b8c4)
      set(x, y, a.status === 'running' && Math.floor(now / 300) % 2 ? 0xffffff : agentColor(a.type))
    })

    if (now < d.city.fireworksUntil)
      for (let k = 0; k < 2; k++) {
        const age = ((now + k * 600) % 1400) / 1400
        const slot = Math.floor((now + k * 600) / 1400) + k * 17
        const cx = Math.round(sx - full / 4 + hash(slot, 1) * (full / 2))
        const cy = Math.round(4 + hash(slot, 2) * 6)
        const col = [0xff5a5a, 0x5affc8, 0xffe14a, 0xc86bff][Math.floor(hash(slot, 3) * 4)]!
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2
          const fx = Math.round(cx + Math.cos(ang) * (1 + age * 4))
          const fy = Math.round(cy + Math.sin(ang) * (1 + age * 4) * 0.6)
          set(fx, fy, mix(col, get(Math.max(0, Math.min(W - 1, fx)), Math.max(0, Math.min(H - 1, fy))), age * age))
        }
      }
  }

  if (w) {
    const sky = { W, ground: H, now, light, isNight, set, get }
    drawFog(sky, w)
    drawPrecipitation(sky, w)
  }
  return px
}
