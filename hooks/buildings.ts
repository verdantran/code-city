import type { Building } from '../types'
import { hash, mix } from './pixels'
import { drawSpecial } from './specials'

export type Canvas = {
  W: number
  set: (x: number, y: number, col: number) => void
  fx: (x: number, y: number, col: number) => void
  get: (x: number, y: number) => number
  shade: (col: number) => number
  isNight: boolean
  now: number
  ground: number
}

const pick = (list: number[] | undefined, roll: number) => list?.[Math.floor(roll * list.length)] ?? list?.[0] ?? 0x888888

const WALLS: Record<Exclude<Building['kind'], 'park' | 'special'>, number[]> = {
  house: [0xd9b38c, 0xc98f6a, 0xe0c9a6, 0xf0e6d2, 0xa9c4d9, 0xc9d9a9, 0xe6b8b8],
  shop: [0x6d8fb3, 0xb3706d, 0x7fa86a, 0xd9a441, 0x8a6db3, 0x4fa3a3],
  tower: [0x55657a, 0x46536a, 0x67788f, 0x3d5a6b, 0x5a4d6b, 0x2f3a4a, 0x7a8a9a],
  apartment: [0xa0522d, 0x8b4513, 0xb5651d, 0x9c6b5a, 0xc08060],
  civic: [0xeae2d0, 0xd8d0c0, 0xf2f2f2, 0xd9c7a0],
  landmark: [0xc8b07a, 0x9a9a9a, 0xb08060],
  factory: [0x7a6a5a, 0x6b6460, 0x846f5c, 0x5a6b5a],
}
const ROOFS = [0xa3442f, 0x6b4a3a, 0x4a5568, 0x3f6b4a, 0x8b3a62]
const AWNINGS = [0xd94040, 0x3f9a5a, 0x3f6fd9, 0xe0a030, 0x9a40c0]
const NEON = [0xff4fd8, 0x4ff0ff, 0xfff04f, 0x7fff4f]
const GLASS = [0x9fd3f5, 0x8fe0d0, 0xb0c8ff, 0xf5d79f]
const DOMES = [0x5fa89a, 0xd4af37, 0x8a9aa8]
const FOLIAGE = [0x2f7d3a, 0x3f9a4a, 0xf0a0c0, 0xe08030, 0x1f5f3a]

type Pattern = 'grid' | 'glass' | 'curtain' | 'vertical' | 'sparse'

function patternOf(b: Building, s: (k: number) => number): Pattern {
  if (b.kind === 'tower') return (['glass', 'curtain', 'vertical', 'grid'] as const)[Math.floor(s(1) * 4)] ?? 'glass'
  if (b.kind === 'civic' || b.kind === 'factory' || b.kind === 'landmark') return 'sparse'
  return 'grid'
}

function isWindow(p: Pattern, col: number, isWindowRow: boolean) {
  if (p === 'curtain' || p === 'vertical') return p === 'curtain' || col % 2 === 1
  if (!isWindowRow) return false
  if (p === 'glass') return true
  if (p === 'sparse') return col % 3 === 1
  return col % 2 === 1
}

export function drawBuilding(cv: Canvas, b: Building, x0: number) {
  const { set, shade, isNight, now } = cv
  const s = (k: number) => hash(b.id, 100 + k)
  const yb = cv.ground - 1
  const mid = x0 + Math.floor(b.w / 2)

  if (b.kind === 'park') return drawPark(cv, b, x0, s)
  if (b.kind === 'special') return drawSpecial(cv, b, x0)

  const wall = shade(pick(WALLS[b.kind], s(0)))
  const tint = pick(GLASS, s(7))
  const pattern = patternOf(b, s)
  const setback = b.kind === 'tower' && b.floors >= 6 && s(2) < 0.4
  const windowAt = (x: number, y: number) => {
    if (!isNight) return mix(tint, 0xffffff, hash(b.id, x, y) * 0.3)
    return hash(b.id, x, y, Math.floor(now / 9000 + hash(b.id, x))) > 0.45 ? 0xffd27a : 0x262b3a
  }

  for (let f = 0; f < b.floors; f++) {
    const inset = setback && f >= b.floors - 2 ? 1 : 0
    for (let r = 0; r < 2; r++) {
      const y = yb - f * 2 - r
      const isWindowRow = r === 1
      for (let x = x0 + inset; x < x0 + b.w - inset; x++) {
        const col = x - x0
        const inner = x > x0 + inset && x < x0 + b.w - 1 - inset
        let px = inner && isWindow(pattern, col, isWindowRow) ? windowAt(col, y) : wall
        if (pattern === 'curtain' && !isWindowRow && inner) px = mix(px, wall, 0.5)
        if (b.kind === 'apartment' && !isWindowRow && f > 0 && col % 2 === 1) px = shade(0x3a3a3a)
        set(x, y, px)
      }
    }
  }

  const roofY = yb - b.floors * 2
  if (b.floors > 0) {
    if (b.kind === 'shop') {
      const awning = pick(AWNINGS, s(3))
      const isStriped = s(4) < 0.6
      for (let x = x0; x < x0 + b.w; x++) set(x, yb - 1, isStriped && (x - x0) % 2 === 0 ? 0xf2f2f2 : awning)
    }
    if (b.kind === 'civic') for (let x = x0; x < x0 + b.w; x++) set(x, yb, (x - x0) % 2 ? shade(0xffffff) : shade(0x8a8478))
    if (b.kind !== 'tower' && b.kind !== 'civic') set(mid, yb, shade(0x3a2a1e))
    drawRoof(cv, b, x0, roofY, s, setback ? 1 : 0)
  }

  if (b.floors < b.target) drawCrane(cv, b, x0, roofY)
}

function drawRoof(cv: Canvas, b: Building, x0: number, roofY: number, s: (k: number) => number, inset: number) {
  const { set, shade, isNight, now } = cv
  const mid = x0 + Math.floor(b.w / 2)
  const blink = Math.floor(now / 800) % 2 === 0
  const flat = (col: number) => {
    for (let x = x0 + inset; x < x0 + b.w - inset; x++) set(x, roofY, shade(col))
  }

  if (b.kind === 'house') {
    const roof = shade(pick(ROOFS, s(3)))
    const style = Math.floor(s(4) * 4)
    if (style === 2) {
      flat(0x4a4a52)
    } else if (style === 3) {
      for (let x = x0; x < x0 + b.w; x++) set(x, roofY, roof)
      for (let x = x0 + 1; x < x0 + b.w - 1; x++) set(x, roofY - 1, roof)
    } else {
      const rows = style === 1 ? Math.ceil(b.w / 2) : 3
      for (let i = 0; i < rows; i++) for (let x = x0 + i; x < x0 + b.w - i; x++) set(x, roofY - i, roof)
    }
    if (s(5) < 0.5) {
      const cx = x0 + b.w - 2
      set(cx, roofY - 1, shade(0x7a3a2a))
      set(cx, roofY - 2, shade(0x7a3a2a))
    }
  } else if (b.kind === 'shop') {
    flat(0x4a4a52)
    const neon = pick(NEON, s(5))
    for (let x = mid - 1; x <= mid + (b.w > 5 ? 1 : 0); x++) set(x, roofY - 1, isNight ? (blink || s(6) < 0.5 ? neon : 0x30303a) : shade(0xe8e8e8))
  } else if (b.kind === 'apartment') {
    flat(0x5a4a40)
    const extra = Math.floor(s(5) * 3)
    if (extra === 0) {
      const wx = x0 + 1
      set(wx, roofY - 1, shade(0x5a4030))
      set(wx + 2, roofY - 1, shade(0x5a4030))
      for (let x = wx; x <= wx + 2; x++) for (let y = roofY - 3; y <= roofY - 2; y++) set(x, y, shade(0x8a5a3a))
    } else if (extra === 1) {
      for (let x = x0 + 1; x < x0 + b.w - 1; x++) set(x, roofY - 1, shade(hash(b.id, x) > 0.4 ? 0x4f9a4a : 0x7fc070))
    }
  } else if (b.kind === 'tower') {
    flat(0x39465a)
    const crown = Math.floor(s(6) * 5)
    const light = isNight && blink ? 0xff3030 : shade(0x9aa4b2)
    if (crown === 0) {
      set(mid, roofY - 1, shade(0x9aa4b2))
      set(mid, roofY - 2, light)
    } else if (crown === 1) {
      const half = Math.floor((b.w - 2 * inset) / 2)
      for (let i = 1; i <= half; i++) for (let x = mid - half + i; x <= mid + half - i; x++) set(x, roofY - i, shade(0x7a8a9a))
      set(mid, roofY - half - 1, light)
    } else if (crown === 2) {
      set(x0 + inset, roofY - 1, isNight && blink ? 0x40ff60 : shade(0x9aa4b2))
      set(x0 + b.w - 1 - inset, roofY - 1, isNight && !blink ? 0x40ff60 : shade(0x9aa4b2))
      set(mid, roofY, shade(0xe8e8e8))
    } else if (crown === 3) {
      for (let x = x0 + inset + 1; x < x0 + b.w - inset - 1; x++) set(x, roofY - 1, shade(0x2a3442))
      for (let x = x0 + inset + 2; x < x0 + b.w - inset - 2; x++) set(x, roofY - 2, shade(0x2a3442))
    } else {
      for (const ax of [x0 + inset + 1, x0 + b.w - inset - 2]) {
        set(ax, roofY - 1, shade(0x9aa4b2))
        set(ax, roofY - 2, shade(0x9aa4b2))
        set(ax, roofY - 3, light)
      }
    }
  } else if (b.kind === 'civic') {
    flat(0xd0c8b8)
    if (s(5) < 0.55) {
      const dome = shade(pick(DOMES, s(6)))
      const r = Math.max(1, Math.floor(b.w / 2) - 1)
      for (let dy = 1; dy <= r; dy++) {
        const half = Math.round(Math.sqrt(r * r - (dy - 1) * (dy - 1)))
        for (let x = mid - half; x <= mid + half; x++) set(x, roofY - dy, dome)
      }
      set(mid, roofY - r - 1, dome)
    } else {
      for (let i = 1; i <= Math.floor(b.w / 2); i++) for (let x = x0 + i; x < x0 + b.w - i; x++) set(x, roofY - i, shade(0xe8e0d0))
    }
    const pole = x0 + b.w - 1
    for (let y = roofY - 1; y > roofY - 5; y--) set(pole, y, shade(0x9a9a9a))
    const flag = pick([0xd94040, 0x3f6fd9, 0x3f9a5a], s(7))
    set(pole - 1, roofY - 4, shade(flag))
    set(pole - 2, roofY - 4 + (blink ? 0 : 1), shade(flag))
  } else if (b.kind === 'landmark') {
    const style = Math.floor(s(5) * 3)
    if (style === 0) {
      const face = roofY + 1
      set(mid - 1, face, shade(0xf8f4e8))
      set(mid, face, Math.floor(now / 1000) % 2 ? shade(0x202020) : shade(0xf8f4e8))
      for (let i = 0; i < 4; i++) for (let x = x0 + Math.floor(i / 2); x < x0 + b.w - Math.floor(i / 2); x++) set(x, roofY - i, shade(0x5a6a7a))
      set(mid, roofY - 4, shade(0xd4af37))
    } else if (style === 1) {
      const r = Math.max(2, Math.floor(b.w / 2))
      for (let dy = 0; dy < r; dy++) {
        const half = Math.round(Math.sqrt(r * r - dy * dy))
        for (let x = mid - half; x <= mid + half; x++) set(x, roofY - dy, shade(0xe8ecf0))
      }
      const slit = Math.floor(now / 3000) % 3
      for (let dy = 1; dy < r; dy++) set(mid - 1 + slit, roofY - dy, 0x101828)
    } else {
      const eave = shade(0xb03a2e)
      for (let f = 0; f <= b.floors; f += 2) {
        const y = cv.ground - 1 - f * 2
        for (let x = x0 - 1; x <= x0 + b.w; x++) set(x, y, eave)
      }
      set(mid, roofY - 1, eave)
      set(mid, roofY - 2, shade(0xd4af37))
    }
  } else if (b.kind === 'factory') {
    for (let x = x0; x < x0 + b.w; x++) set(x, roofY - ((x - x0) % 3 === 0 ? 1 : 0), shade(0x5a4e44))
    const stacks = s(5) < 0.5 ? [x0 + b.w - 2] : [x0 + 1, x0 + b.w - 2]
    stacks.forEach((cx, j) => {
      const tall = 4 + Math.floor(s(6 + j) * 3)
      for (let y = roofY; y > roofY - tall; y--) set(cx, y, shade(y % 3 === 0 ? 0xe8e8e8 : 0x8a3b2b))
      for (let k = 0; k < 4; k++) {
        const rise = (now / 350 + k * 2.5 + j * 4) % 9
        const sx = cx + Math.round(Math.sin(now / 600 + k) + rise / 3)
        const sy = Math.round(roofY - tall - rise)
        if (sy >= 0 && sx >= 0 && sx < cv.W) cv.fx(sx, sy, mix(cv.get(sx, sy), 0xc8c8c8, 0.7 - rise / 14))
      }
    })
  } else {
    flat(0x4a4a52)
  }
}

function drawPark(cv: Canvas, b: Building, x0: number, s: (k: number) => number) {
  const { set, shade, now } = cv
  const yb = cv.ground - 1
  for (let x = x0; x < x0 + b.w; x++) set(x, yb, shade(0x4f9a4a))
  const feature = Math.floor(s(1) * 3)
  for (let tx = x0 + 1, k = 0; tx < x0 + b.w - 1; tx += 3, k++) {
    if (feature === 1 && k === 1) {
      set(tx, yb - 1, shade(0x9aa4b2))
      set(tx, yb - 2 - (Math.floor(now / 400) % 2), 0x6fc8f0)
      continue
    }
    if (feature === 2 && k === 1) {
      set(tx - 1, yb - 1, shade(0x6b4a2b))
      set(tx, yb - 1, shade(0x6b4a2b))
      continue
    }
    const leaf = shade(pick(FOLIAGE, hash(b.id, tx)))
    const isPine = hash(b.id, tx, 3) < 0.35
    set(tx, yb - 1, shade(0x6b4a2b))
    if (isPine) {
      for (let dy = 2; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) set(tx + dx, yb - dy, shade(0x1f5f3a))
      set(tx, yb - 4, shade(0x1f5f3a))
      set(tx, yb - 5, shade(0x1f5f3a))
    } else {
      for (let dx = -1; dx <= 1; dx++) for (let dy = 2; dy <= 3; dy++) set(tx + dx, yb - dy, leaf)
      set(tx, yb - 4, leaf)
    }
  }
  if (b.floors < b.target) set(x0 + Math.floor(b.w / 2), yb - 1, 0xf2b33d)
}

function drawCrane(cv: Canvas, b: Building, x0: number, roofY: number) {
  const { set, now } = cv
  const yb = cv.ground - 1
  const scaffold = 0xf2b33d
  for (let y = roofY; y > roofY - 2; y--) for (let x = x0; x < x0 + b.w; x++) if ((x + y) % 2 === 0) set(x, y, scaffold)
  const mast = x0 + b.w
  const topY = Math.max(1, yb - b.target * 2 - 3)
  for (let y = yb; y >= topY; y--) set(mast, y, scaffold)
  for (let x = x0 - 2; x <= mast + 2; x++) set(x, topY, scaffold)
  const hookX = x0 + Math.floor(b.w / 2)
  const drop = topY + 1 + Math.round((Math.sin(now / 700) + 1) * 1.5)
  for (let y = topY + 1; y < drop; y++) cv.fx(hookX, y, 0x707070)
  cv.fx(hookX, drop, 0x9a5a2a)
}
