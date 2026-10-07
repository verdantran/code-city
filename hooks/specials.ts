import type { Building, City } from '../types'
import type { Canvas } from './buildings'
import { hash, mix } from './pixels'
import { owns } from './shop'

const GONDOLAS = [0xd94040, 0x3f6fd9, 0xf2d24a, 0x40a060, 0x9a50c0, 0xff9f43]

export function drawSpecial(cv: Canvas, b: Building, x0: number) {
  const yb = cv.ground - 1
  if (b.floors < b.target) {
    for (let x = x0; x < x0 + b.w; x++) {
      cv.set(x, yb, (x - x0) % 2 ? 0xf2b33d : 0x2a2a2a)
      if ((x - x0) % 3 === 0) cv.set(x, yb - 1, 0xf2b33d)
    }
    cv.fx(x0 + Math.floor(b.w / 2), yb - 2 - (Math.floor(cv.now / 500) % 2), 0xf2b33d)
    return
  }
  if (b.special === 'plaza') drawPlaza(cv, b, x0, yb)
  else if (b.special === 'ferris') drawFerris(cv, b, x0, yb)
  else if (b.special === 'stadium') drawStadium(cv, b, x0, yb)
  else if (b.special === 'needle') drawNeedle(cv, x0, yb)
  else if (b.special === 'rocket') drawRocket(cv, b, x0, yb)
  else if (b.special === 'biodome') drawBiodome(cv, b, x0, yb)
  else if (b.special === 'supertall') drawSupertall(cv, b, x0, yb)
  else if (b.special === 'elevator') drawElevator(cv, x0, yb)
}

function drawBiodome(cv: Canvas, b: Building, x0: number, yb: number) {
  const { set, shade, now, isNight } = cv
  const cx = x0 + Math.floor(b.w / 2)
  const r = Math.floor(b.w / 2)
  for (let x = x0; x < x0 + b.w; x++) set(x, yb, shade(0x9aa4b2))
  for (let dy = 1; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - (dy - 1) * (dy - 1)))
    for (let x = cx - half; x <= cx + half; x++) {
      const isEdge = x === cx - half || x === cx + half || dy === r
      const isMullion = (x - cx) % 3 === 0 || dy % 3 === 0
      const inside = dy <= 3 && hash(x, dy, 41) > 0.35 ? (hash(x, dy, 42) > 0.8 ? 0xe86a8a : 0x3f9a4a) : 0x8fd8e8
      const glass = isNight ? mix(inside === 0x8fd8e8 ? 0x1a3a3a : inside, 0x7fffb0, 0.25 + 0.1 * Math.sin(now / 900 + x)) : mix(inside, 0xffffff, 0.25)
      set(x, yb - dy, isEdge || isMullion ? shade(0xd0dce4) : shade(glass))
    }
  }
}

function drawSupertall(cv: Canvas, b: Building, x0: number, yb: number) {
  const { set, fx, shade, now, isNight } = cv
  const height = Math.max(12, yb - 2)
  const tiers = [
    { w: b.w, upTo: 0.42 },
    { w: b.w - 2, upTo: 0.7 },
    { w: b.w - 4, upTo: 0.88 },
    { w: b.w - 6, upTo: 0.94 },
  ]
  const mid = x0 + Math.floor(b.w / 2)
  for (let h = 0; h < height * 0.94; h++) {
    const tier = tiers.find(t => h < height * t.upTo) ?? tiers[tiers.length - 1]!
    const half = Math.floor(tier.w / 2)
    const y = yb - h
    for (let x = mid - half; x <= mid + half; x++) {
      const isEdge = x === mid - half || x === mid + half
      const lit = isNight ? (hash(x, h, Math.floor(now / 7000)) > 0.4 ? 0xffe2a0 : 0x1e2838) : mix(0x9fc8e8, 0xffffff, hash(x, h) * 0.3)
      set(x, y, isEdge ? shade(0x5a6a80) : h % 2 ? lit : shade(0x3a4658))
    }
  }
  const crownY = yb - Math.floor(height * 0.94)
  const crown = isNight ? [0xff4fd8, 0x4ff0ff, 0xfff04f, 0x7fff4f][Math.floor(now / 1500) % 4]! : shade(0xd8dce4)
  for (let x = mid - 1; x <= mid + 1; x++) set(x, crownY, crown)
  for (let y = crownY - 1; y >= Math.max(0, yb - height); y--) set(mid, y, shade(0xc8ccd4))
  fx(mid, Math.max(0, yb - height), Math.floor(now / 700) % 2 ? 0xff3030 : shade(0xc8ccd4))
}

function drawElevator(cv: Canvas, x0: number, yb: number) {
  const { set, fx, shade, now, isNight } = cv
  const mid = x0 + 2
  for (let r = 0; r < 3; r++) for (let x = x0 + r; x < x0 + 5 - r; x++) set(x, yb - r, shade(r === 1 ? 0x6a7a90 : 0x8a96a8))
  for (let y = yb - 3; y >= 0; y--) set(mid, y, mix(cv.get(mid, y), 0xe8ecf0, 0.7))
  const trip = (now / 1000) % 40
  const rise = trip < 20 ? trip / 20 : 2 - trip / 20
  const cy = Math.round(yb - 4 - rise * (yb - 6))
  fx(mid - 1, cy, shade(0xd8dce4))
  fx(mid + 1, cy, shade(0xd8dce4))
  fx(mid, cy, isNight || Math.floor(now / 400) % 2 ? 0x7fd8ff : shade(0xd8dce4))
}

function drawPlaza(cv: Canvas, b: Building, x0: number, yb: number) {
  const { set, fx, shade, now } = cv
  for (let x = x0; x < x0 + b.w; x++) set(x, yb, shade((x - x0) % 2 ? 0xd8d0c0 : 0xc8c0b0))
  const mid = x0 + Math.floor(b.w / 2)
  for (let x = mid - 2; x <= mid + 2; x++) set(x, yb - 1, shade(0x9aa4b2))
  set(mid - 1, yb - 1, 0x4f9fd9)
  set(mid, yb - 1, 0x4f9fd9)
  set(mid + 1, yb - 1, 0x4f9fd9)
  const jet = 2 + Math.round((Math.sin(now / 300) + 1) * 1.2)
  for (let y = 2; y <= jet + 1; y++) fx(mid, yb - y, mix(0x9fd8ff, 0xffffff, y / (jet + 2)))
  const spray = Math.floor(now / 200) % 2
  fx(mid - 1 - spray, yb - jet, 0xbfe6ff)
  fx(mid + 1 + spray, yb - jet, 0xbfe6ff)
  set(x0, yb - 1, shade(0x6b4a2b))
  set(x0 + b.w - 1, yb - 1, shade(0x6b4a2b))
}

function drawFerris(cv: Canvas, b: Building, x0: number, yb: number) {
  const { set, fx, shade, now, isNight } = cv
  const cx = x0 + Math.floor(b.w / 2)
  const r = Math.floor(b.w / 2) - 1
  const cy = yb - r - 2
  const frame = shade(0xe8e8e8)
  for (let y = cy; y <= yb; y++) {
    const spread = Math.round(((y - cy) / (yb - cy)) * (r - 1))
    set(cx - spread, y, shade(0x9aa4b2))
    set(cx + spread, y, shade(0x9aa4b2))
  }
  for (let a = 0; a < 48; a++) {
    const ang = (a / 48) * Math.PI * 2
    set(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), frame)
  }
  const turn = now / 6000
  for (let s = 0; s < 4; s++) {
    const ang = turn + (s / 4) * Math.PI
    for (let d = 1; d < r; d++) fx(Math.round(cx + Math.cos(ang) * d), Math.round(cy + Math.sin(ang) * d), shade(0xb0b8c4))
  }
  for (let g = 0; g < 8; g++) {
    const ang = turn + (g / 8) * Math.PI * 2
    const gx = Math.round(cx + Math.cos(ang) * r)
    const gy = Math.round(cy + Math.sin(ang) * r) + 1
    const col = GONDOLAS[g % GONDOLAS.length] ?? 0xd94040
    fx(gx, gy, isNight ? (Math.floor(now / 400 + g) % 3 ? col : 0xffffff) : shade(col))
  }
  set(cx, cy, shade(0x707070))
}

function drawStadium(cv: Canvas, b: Building, x0: number, yb: number) {
  const { set, fx, shade, now, isNight } = cv
  const h = 5
  for (let r = 0; r < h; r++) {
    const inset = Math.max(0, r - 2)
    for (let x = x0 + inset; x < x0 + b.w - inset; x++) {
      const isStand = r >= 1 && r <= 3 && x > x0 + inset && x < x0 + b.w - inset - 1
      const fan = GONDOLAS[Math.floor(hash(x, r, Math.floor(now / 600)) * GONDOLAS.length)] ?? 0xd94040
      set(x, yb - r, isStand ? shade(hash(x, r) > 0.35 ? fan : 0x5a6070) : shade(0x8a909c))
    }
  }
  for (let x = x0 + 3; x < x0 + b.w - 3; x++) set(x, yb - h, shade(0xe8e8e8))
  for (const px of [x0, x0 + b.w - 1]) {
    for (let y = yb; y > yb - 9; y--) set(px, y, shade(0x707680))
    const head = isNight ? 0xffffe0 : shade(0xd0d4dc)
    fx(px, yb - 9, head)
    fx(px + (px === x0 ? 1 : -1), yb - 9, head)
    if (isNight)
      for (let k = 1; k < 5; k++) {
        const bx = px + (px === x0 ? k : -k)
        const by = yb - 9 + k
        fx(bx, by, mix(cv.get(Math.max(0, Math.min(cv.W - 1, bx)), Math.max(0, by)), 0xffffe0, 0.3))
      }
  }
}

function drawNeedle(cv: Canvas, x0: number, yb: number) {
  const { set, shade, now, isNight } = cv
  const mid = x0 + 2
  const top = Math.max(3, Math.round(cv.ground * 0.2))
  const pod = top + 3
  for (let y = yb; y > top; y--) {
    set(mid, y, shade(0xc8ccd4))
    if (y > yb - 4) {
      set(mid - 1, y, shade(0x9aa4b2))
      set(mid + 1, y, shade(0x9aa4b2))
    }
  }
  for (let x = x0; x < x0 + 5; x++) set(x, pod, shade(0xd8dce4))
  for (let x = x0; x < x0 + 5; x++) set(x, pod + 1, isNight ? (hash(x, Math.floor(now / 1500)) > 0.3 ? 0xffd27a : 0x3a3a48) : shade(0x8fd0f0))
  for (let x = x0 + 1; x < x0 + 4; x++) set(x, pod + 2, shade(0xd8dce4))
  set(mid, top, isNight && Math.floor(now / 700) % 2 ? 0xff3030 : shade(0xe8e8e8))
}

const LAUNCH_EVERY = 180_000

function drawRocket(cv: Canvas, b: Building, x0: number, yb: number) {
  const { set, fx, shade, now } = cv
  for (let x = x0; x < x0 + b.w; x++) set(x, yb, shade(0x6a6f78))
  const gantry = x0 + 1
  for (let y = yb - 1; y > yb - 11; y--) {
    set(gantry, y, shade(0xd94040))
    if (y % 2 === 0) set(gantry + 1, y, shade(0x9a3030))
  }
  const t = (now + b.id * 7919) % LAUNCH_EVERY
  const rx = x0 + 4
  const climbing = t > 150_000 && t < 168_000
  const gone = t >= 168_000
  if (gone) return
  const lift = climbing ? Math.round(((t - 150_000) / 1000) ** 2 * 0.4) : 0
  const base = yb - 1 - lift
  for (let y = base; y > base - 8; y--) {
    const col = y <= base - 6 ? 0xd94040 : 0xf2f2f2
    fx(rx, y, shade(col))
    if (y > base - 6) fx(rx + 1, y, shade(0xd8dce4))
  }
  fx(rx - 1, base, shade(0x9aa4b2))
  fx(rx + 2, base, shade(0x9aa4b2))
  if (climbing || t > 140_000) {
    const flicker = Math.floor(now / 80) % 2
    fx(rx, base + 1, flicker ? 0xffe14a : 0xff8a30)
    fx(rx + 1, base + 1, flicker ? 0xff8a30 : 0xffe14a)
    if (climbing) {
      fx(rx, base + 2, 0xff5a30)
      for (let y = base + 3; y <= yb; y++) fx(rx + Math.round(Math.sin(y + now / 200)), y, mix(cv.get(Math.max(0, rx), Math.max(0, y)), 0xd8d8d8, 0.6))
    }
  }
}

/** Trees and lamps along the pavement, in world space so they pan with the city. */
export function drawStreetscape(cv: Canvas, c: City, off: number, season: string) {
  const { W, set, fx, shade, ground, isNight } = cv
  const hasTrees = owns(c, 'trees')
  const hasLamps = owns(c, 'lamps')
  if (!hasTrees && !hasLamps) return
  const leaf = { winter: 0, spring: 0x5fb85a, summer: 0x2f7d3a, autumn: 0xd8782a }[season] ?? 0x2f7d3a
  for (let x = 0; x < W; x++) {
    const wx = x - off
    const slot = ((wx % 12) + 12) % 12
    if (hasTrees && slot === 3) {
      set(x, ground, shade(0x6b4a2b))
      fx(x, ground - 1, shade(0x6b4a2b))
      if (leaf === 0) {
        fx(x - 1, ground - 2, shade(0x6b4a2b))
        fx(x + 1, ground - 3, shade(0x6b4a2b))
        fx(x, ground - 3, shade(0x6b4a2b))
      } else
        for (let dx = -1; dx <= 1; dx++) for (let dy = 2; dy <= 3; dy++) fx(x + dx, ground - dy, shade(hash(wx, dx, dy) > 0.8 ? mix(leaf, 0xffffff, 0.2) : leaf))
    }
    if (hasLamps && slot === 9) {
      for (let y = ground; y > ground - 4; y--) fx(x, y, shade(0x4a4e58))
      fx(x + 1, ground - 4, shade(0x4a4e58))
      fx(x + 1, ground - 3, isNight ? 0xfff0b0 : shade(0xd0d4dc))
      if (isNight)
        for (let dx = -1; dx <= 3; dx++)
          for (let y = ground; y < ground + 3; y++) {
            const px = x + dx
            if (px >= 0 && px < W) set(px, y, mix(cv.get(px, y), 0xfff0b0, 0.18))
          }
    }
  }
}

/** The balloon and the airport's planes, in screen space. */
export function drawSkyline(cv: Canvas, c: City, off: number) {
  const { W, fx, shade, now, isNight, ground } = cv
  const secs = now / 1000

  if (owns(c, 'balloon')) {
    const span = W + 12
    const x = Math.round(((secs * 1.2) % span) - 6)
    const y = Math.round(ground * 0.22 + Math.sin(secs / 3) * 2)
    const stripes = [0xd94040, 0xf2d24a, 0x3f6fd9]
    for (let dy = 0; dy < 5; dy++) {
      const half = dy === 0 || dy === 4 ? 1 : 2
      for (let dx = -half; dx <= half; dx++) fx(x + dx, y + dy, shade(stripes[(dx + 3) % 3] ?? 0xd94040))
    }
    fx(x - 1, y + 5, shade(0x6b4a2b))
    fx(x + 1, y + 5, shade(0x6b4a2b))
    fx(x, y + 6, shade(0x8a5a3a))
    if (isNight) fx(x, y + 4, 0xffb040)
  }

  if (owns(c, 'airport')) {
    const period = 45
    const t = secs % period
    const flight = Math.floor(secs / period)
    const dir = hash(flight, 61) < 0.5 ? 1 : -1
    const speed = 14
    const travelled = t * speed
    if (travelled < W + 30) {
      const x = Math.round(dir > 0 ? travelled - 8 : W + 8 - travelled)
      const y = 1 + Math.round(hash(flight, 62) * 3)
      for (let k = 1; k < 18; k++) {
        const tx = x - dir * (k + 3)
        if (tx >= 0 && tx < W) fx(tx, y, mix(cv.get(tx, y), 0xffffff, 0.5 * (1 - k / 18)))
      }
      for (let k = 0; k < 4; k++) fx(x - dir * k, y, shade(0xe8ecf0))
      fx(x - dir * 3, y - 1, shade(0xd8dce4))
      fx(x - dir, y + 1, shade(0xb8bcc4))
      const blink = Math.floor(now / 500) % 2
      if (isNight || blink) fx(x, y, blink ? 0xff3030 : 0x40ff60)
    }
  }

  if (owns(c, 'airship')) {
    const span = W + 24
    const x = Math.round(W + 12 - ((secs * 0.8 + 40) % span))
    const y = Math.round(ground * 0.12 + 2 + Math.sin(secs / 5) * 1)
    const hull = shade(0xc8ccd4)
    for (let dx = -6; dx <= 6; dx++) {
      const half = Math.abs(dx) >= 6 ? 0 : Math.abs(dx) >= 4 ? 1 : 2
      for (let dy = -half; dy <= half; dy++) fx(x + dx, y + dy, dy === half ? mix(hull, 0x000000, 0.2) : hull)
    }
    fx(x + 7, y - 1, shade(0x9aa4b2))
    fx(x + 7, y + 1, shade(0x9aa4b2))
    fx(x - 1, y + 3, shade(0x6a6f78))
    fx(x, y + 3, shade(0x6a6f78))
    if (isNight)
      for (let dx = -4; dx <= 3; dx++) fx(x + dx, y, (Math.floor(now / 250) + dx) % 3 === 0 ? 0xffe14a : 0xff4fd8)
  }

  if (owns(c, 'monorail')) {
    const track = Math.max(4, ground - 11)
    const reach = c.buildings.reduce((m, b) => Math.max(m, b.x + b.w), 0)
    const from = Math.max(0, off)
    const to = Math.min(W, off + reach)
    for (let x = from; x < to; x++) {
      fx(x, track, shade(0x9aa4b2))
      const wx = x - off
      if (wx % 24 === 2 || x === from || x === to - 1) for (let y = track + 1; y < ground; y++) fx(x, y, shade(0x7a8494))
    }
    const len = 10
    const span = Math.max(1, reach - len)
    const travel = (secs * 9) % (span * 2)
    const start = off + Math.round(travel < span ? travel : span * 2 - travel)
    for (let k = 0; k < len; k++) {
      const x = start + k
      if (x < from || x >= to) continue
      fx(x, track - 1, k === len - 1 ? (isNight ? 0xfff4b0 : shade(0xffffff)) : k % 2 ? (isNight ? 0xffe2a0 : 0x3f8fe0) : shade(0xf2f2f2))
      fx(x, track - 2, shade(0xf2f2f2))
    }
  }
}

/** Things beyond the clouds: drawn behind the city. */
export function drawHeavens(cv: Canvas, c: City, light: number, moon: { x: number; y: number } | undefined) {
  const { W, fx, get, now, ground } = cv
  const secs = now / 1000
  const glow = 1 - light * 0.6

  if (owns(c, 'ring')) {
    for (let x = 0; x < W; x++) {
      const t = (x - W / 2) / (W * 0.62)
      const y = Math.round(ground * 0.42 - (1 - t * t) * ground * 0.34)
      if (y < 0 || y >= ground) continue
      fx(x, y, mix(get(x, y), 0xffe8a8, 0.55 * glow))
      if (y + 1 < ground) fx(x, y + 1, mix(get(x, y + 1), 0xffd070, 0.2 * glow))
      if ((x + Math.floor(secs * 6)) % 17 === 0) fx(x, y, mix(get(x, y), 0xffffff, 0.9))
    }
  }

  if (owns(c, 'station')) {
    const period = 90
    const t = (secs % period) / period
    const x = Math.round(t * (W + 10) - 5)
    const y = 3
    const at = (px: number) => get(Math.max(0, Math.min(W - 1, px)), y)
    const panel = mix(0x3f6fd9, 0xffffff, 0.2 * glow)
    for (const dx of [-3, -2, 2, 3]) fx(x + dx, y, mix(at(x + dx), panel, 0.5 + 0.4 * glow))
    fx(x - 1, y, mix(at(x - 1), 0xd8dce4, 0.8))
    fx(x, y, Math.floor(now / 600) % 2 ? 0xffffff : 0xd8dce4)
    fx(x + 1, y, mix(at(x + 1), 0xd8dce4, 0.8))
  }

  if (owns(c, 'moonbase') && moon && light < 0.5) {
    fx(moon.x - 1, moon.y + 1, Math.floor(now / 500) % 2 ? 0x4ff0ff : 0x2a8aa0)
    fx(moon.x + 1, moon.y, Math.floor(now / 700) % 2 ? 0xffe14a : 0xa08020)
    const trip = (secs % 60) / 60
    if (trip < 0.5) {
      const p = trip < 0.25 ? trip * 4 : (0.5 - trip) * 4
      const sx = Math.round(W * 0.5 + (moon.x - W * 0.5) * p)
      const sy = Math.round(ground - 2 + (moon.y + 2 - ground) * p)
      fx(sx, sy, 0xffffff)
      fx(sx, sy + 1, 0xff8a30)
    }
  }
}
