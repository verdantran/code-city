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
  else if (b.special === 'lighthouse') drawLighthouse(cv, x0, yb)
  else if (b.special === 'turbine') drawTurbine(cv, b, x0, yb)
  else if (b.special === 'castle') drawCastle(cv, b, x0, yb)
  else if (b.special === 'pyramid') drawPyramid(cv, b, x0, yb)
}

function drawLighthouse(cv: Canvas, x0: number, yb: number) {
  const { W, set, fx, get, shade, now, isNight } = cv
  const mid = x0 + 2
  const top = yb - 11
  for (let h = 0; h < 10; h++) {
    const half = h < 4 ? 2 : 1
    for (let x = mid - half; x <= mid + half; x++) set(x, yb - h, shade(Math.floor(h / 2) % 2 ? 0xd94040 : 0xf2f2f2))
  }
  set(mid - 1, top + 1, shade(0x3a3a48))
  set(mid + 1, top + 1, shade(0x3a3a48))
  set(mid, top + 1, isNight ? 0xfff4b0 : shade(0xf2d24a))
  for (let x = mid - 1; x <= mid + 1; x++) set(x, top, shade(0xd94040))
  set(mid, top - 1, shade(0x3a3a48))
  if (!isNight) return
  // The beam sweeps out one side, then the other, fading with distance.
  const sweep = Math.sin(now / 1400)
  const dir = sweep >= 0 ? 1 : -1
  const reach = Math.round(Math.abs(sweep) * 22)
  for (let k = 2; k <= reach; k++) {
    const x = mid + dir * k
    const y = top + 1 - Math.round(k / 8)
    if (x >= 0 && x < W && y >= 0) fx(x, y, mix(get(x, y), 0xfff4b0, 0.55 * (1 - k / 24)))
  }
}

function drawTurbine(cv: Canvas, b: Building, x0: number, yb: number) {
  const { fx, set, shade, now, isNight } = cv
  const mid = x0 + Math.floor(b.w / 2)
  const hub = yb - 12
  for (let y = yb; y > hub; y--) set(mid, y, shade(0xe8ecf0))
  set(mid - 1, yb, shade(0x9aa4b2))
  set(mid + 1, yb, shade(0x9aa4b2))
  const turn = now / 900 + b.id
  for (let k = 0; k < 3; k++) {
    const ang = turn + (k * Math.PI * 2) / 3
    for (let d = 1; d <= 4; d++) fx(Math.round(mid + Math.cos(ang) * d), Math.round(hub + Math.sin(ang) * d), shade(0xf2f2f2))
  }
  fx(mid, hub, isNight && Math.floor(now / 900) % 2 ? 0xff3030 : shade(0xc8ccd4))
}

function drawCastle(cv: Canvas, b: Building, x0: number, yb: number) {
  const { set, fx, shade, now, isNight } = cv
  const stone = (x: number, y: number) => shade(hash(x, y, 51) > 0.8 ? 0x8a8478 : 0xa8a294)
  const x1 = x0 + b.w - 1
  const mid = x0 + Math.floor(b.w / 2)
  for (let x = x0; x <= x1; x++) for (let h = 0; h < 4; h++) set(x, yb - h, stone(x, h))
  for (let x = x0 + 2; x <= x1 - 2; x += 2) set(x, yb - 4, stone(x, 4))
  for (const tx of [x0, x1 - 1]) {
    for (let x = tx; x <= tx + 1; x++) for (let h = 4; h < 7; h++) set(x, yb - h, stone(x, h))
    set(tx, yb - 7, stone(tx, 7))
    set(tx + 1, yb - 5, isNight ? 0xffd27a : shade(0x3a3a48))
  }
  for (let x = mid - 1; x <= mid + 1; x++) for (let h = 4; h < 8; h++) set(x, yb - h, stone(x, h))
  set(mid - 1, yb - 8, stone(mid - 1, 8))
  set(mid + 1, yb - 8, stone(mid + 1, 8))
  set(mid, yb - 6, isNight ? 0xffd27a : shade(0x3a3a48))
  set(mid, yb, shade(0x3a2a1a))
  set(mid, yb - 1, shade(0x3a2a1a))
  for (let y = yb - 8; y > yb - 12; y--) set(mid, y, shade(0x6a6f78))
  const wave = Math.floor(now / 300) % 2
  fx(mid + 1, yb - 11, shade(0xd94040))
  fx(mid + 2, yb - 11 + wave, shade(0xd94040))
  fx(mid + 1, yb - 10, shade(0xb03030))
}

function drawPyramid(cv: Canvas, b: Building, x0: number, yb: number) {
  const { W, set, fx, get, shade, now, isNight } = cv
  const mid = x0 + Math.floor(b.w / 2)
  const rows = Math.ceil(b.w / 2)
  for (let r = 0; r < rows; r++) {
    const half = Math.floor(b.w / 2) - r
    for (let x = mid - half; x <= mid + half; x++) {
      const isEdge = x === mid - half || x === mid + half
      const pane = isNight ? mix(0x1a2a3a, 0xffe2a0, hash(x, r, Math.floor(now / 5000)) > 0.55 ? 0.7 : 0.1) : mix(0x9fc8e8, 0xffffff, hash(x, r) * 0.35)
      set(x, yb - r, isEdge || r % 3 === 0 ? shade(0x6a7a90) : shade(pane))
    }
  }
  if (!isNight) return
  for (let y = yb - rows; y >= 0; y--) if (mid >= 0 && mid < W) fx(mid, y, mix(get(mid, y), 0xe8f4ff, 0.45 * (y / (yb - rows + 1)) + 0.1))
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

const FLOWERS = [0xe86a8a, 0xf2d24a, 0xffffff, 0x9a50c0, 0xff8a30]
const BUNTING = [0xd94040, 0xf2d24a, 0x3f6fd9, 0x40a060]

/** One truck, parked a little way along the street, with steam drifting up from its grill. */
function drawFoodTruck(cv: Canvas, off: number) {
  const { fx, get, shade, now, isNight, ground } = cv
  const x0 = off + 14
  for (let dx = 0; dx < 7; dx++) {
    fx(x0 + dx, ground - 1, shade(0xf2f2f2))
    fx(x0 + dx, ground - 2, shade(dx === 2 || dx === 3 ? (isNight ? 0xffe2a0 : 0x3a3a48) : 0xf2f2f2))
    if (dx < 5) fx(x0 + dx, ground - 3, shade(0xf2b33d))
  }
  fx(x0 + 1, ground, shade(0x2a2a2a))
  fx(x0 + 5, ground, shade(0x2a2a2a))
  const rise = (now / 300) % 4
  const sx = x0 + 1 + Math.round(Math.sin(now / 500))
  const sy = Math.round(ground - 4 - rise)
  if (sx >= 0 && sx < cv.W && sy >= 0) fx(sx, sy, mix(get(sx, sy), 0xe8e8e8, 0.6 * (1 - rise / 4)))
}

/** Trees, lamps and the rest of the street furniture along the pavement, in world space so they pan with the city. */
export function drawStreetscape(cv: Canvas, c: City, off: number, season: string) {
  const { W, set, fx, shade, ground, isNight } = cv
  const hasTrees = owns(c, 'trees')
  const hasLamps = owns(c, 'lamps')
  const hasFlowers = owns(c, 'flowers')
  const hasBenches = owns(c, 'benches')
  const hasBunting = owns(c, 'bunting')
  if (owns(c, 'foodtruck')) drawFoodTruck(cv, off)
  if (!hasTrees && !hasLamps && !hasFlowers && !hasBenches && !hasBunting) return
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
    if (hasFlowers && (slot === 5 || slot === 6)) {
      fx(x, ground - 1, shade(0x3f8a3a))
      fx(x, ground - 2, shade(FLOWERS[Math.floor(hash(wx, 31) * FLOWERS.length)] ?? 0xe86a8a))
    }
    const bench = ((wx % 36) + 36) % 36
    if (hasBenches && bench < 3) {
      const at = bench
      fx(x, ground - 1, shade(0x8a5a3a))
      if (at !== 1) fx(x, ground, shade(0x4a4e58))
      if (at === 0) fx(x, ground - 2, shade(0x8a5a3a))
    }
    if (hasBunting) {
      const sag = Math.round(Math.sin((slot / 12) * Math.PI) * 1.5)
      const y = ground - 9 + sag + (slot % 2 ? 0 : Math.round(Math.sin(cv.now / 600 + wx) * 0.4))
      fx(x, y, shade(0x6a6f78))
      if (slot % 2 === 1) fx(x, y + 1, shade(BUNTING[((Math.floor(wx / 2) % BUNTING.length) + BUNTING.length) % BUNTING.length] ?? 0xd94040))
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

  if (owns(c, 'birds') && !isNight) drawBirds(cv)
  if (owns(c, 'kites')) drawKites(cv)
  if (owns(c, 'ufo')) drawUfo(cv)

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

function drawBirds(cv: Canvas) {
  const { W, fx, shade, now, ground } = cv
  const secs = now / 1000
  const period = 40
  const flock = Math.floor(secs / period)
  const x = Math.round(((secs % period) / period) * (W + 30)) - 15
  const y0 = Math.round(ground * (0.15 + hash(flock, 31) * 0.25))
  for (let k = 0; k < 5; k++) {
    const bx = x - Math.abs(k - 2) * 3
    const by = y0 + Math.abs(k - 2) * 2 + (k % 2)
    const flap = Math.floor(now / 250 + k) % 2
    fx(bx, by, shade(0x2a2a3a))
    fx(bx - 1, by - flap, shade(0x2a2a3a))
    fx(bx + 1, by - flap, shade(0x2a2a3a))
  }
}

const KITE_COLOURS = [0xd94040, 0xf2d24a, 0x3f6fd9, 0x9a50c0]

function drawKites(cv: Canvas) {
  const { W, fx, shade, now, ground } = cv
  const secs = now / 1000
  for (let k = 0; k < 3; k++) {
    const x = Math.round(((k + 0.5) * W) / 3 + Math.sin(secs / 2.3 + k * 2) * 4)
    const y = Math.round(ground * 0.3 + k * 2 + Math.sin(secs / 1.7 + k) * 2)
    const col = shade(KITE_COLOURS[k % KITE_COLOURS.length] ?? 0xd94040)
    fx(x, y - 1, col)
    fx(x - 1, y, col)
    fx(x, y, shade(0xf2f2f2))
    fx(x + 1, y, col)
    fx(x, y + 1, col)
    for (let t = 2; t <= 5; t++) fx(x + Math.round(Math.sin(secs * 3 + t + k) * 0.8), y + t, t % 2 ? col : shade(0xf2f2f2))
  }
}

const UFO_EVERY = 150

function drawUfo(cv: Canvas) {
  const { W, fx, get, shade, now, isNight, ground } = cv
  const secs = now / 1000
  const t = secs % UFO_EVERY
  if (t > 30) return
  const visit = Math.floor(secs / UFO_EVERY)
  // Swoops in from one side, hovers, then leaves the way it came.
  const home = Math.round(W * (0.25 + hash(visit, 71) * 0.5))
  const from = hash(visit, 72) < 0.5 ? -8 : W + 8
  const p = t < 6 ? t / 6 : t > 24 ? (30 - t) / 6 : 1
  const x = Math.round(from + (home - from) * p + (p === 1 ? Math.sin(secs * 1.5) * 2 : 0))
  const y = Math.round(ground * 0.25 + Math.sin(secs * 2) * 0.6)
  if (p === 1 && t > 9 && t < 21)
    for (let by = y + 2; by < ground; by++) {
      const spread = Math.floor((by - y) / 3)
      for (let dx = -spread; dx <= spread; dx++) {
        const bx = x + dx
        if (bx >= 0 && bx < W) fx(bx, by, mix(get(bx, by), 0x9fffb0, isNight ? 0.3 : 0.18))
      }
    }
  for (let dx = -1; dx <= 1; dx++) fx(x + dx, y - 1, shade(0x7fd8ff))
  for (let dx = -3; dx <= 3; dx++) fx(x + dx, y, shade(0x9aa4b2))
  for (let dx = -2; dx <= 2; dx++) fx(x + dx, y + 1, (Math.floor(now / 200) + dx) % 3 === 0 ? 0xffe14a : shade(0x6a6f78))
}

/** Things beyond the clouds: drawn behind the city. */
export function drawHeavens(
  cv: Canvas,
  c: City,
  light: number,
  moon: { x: number; y: number } | undefined,
) {
  const { W, fx, get, now, ground } = cv
  const secs = now / 1000
  const glow = 1 - light * 0.6

  if (owns(c, 'meteors') && light < 0.5) {
    // A few streaks a minute, each a bright head with a fading tail, falling left to right.
    for (let k = 0; k < 3; k++) {
      const period = 7 + k * 3
      const shot = Math.floor(secs / period)
      const t = (secs % period) / 1.2
      if (t > 1) continue
      const sx = Math.round(hash(shot, k, 81) * W)
      const sy = Math.round(hash(shot, k, 82) * ground * 0.35)
      const len = 9
      const hx = sx + Math.round(t * 14)
      const hy = sy + Math.round(t * 6)
      for (let j = 0; j < len; j++) {
        const x = hx - Math.round((j * 14) / 18)
        const y = hy - Math.round((j * 6) / 18)
        if (x >= 0 && x < W && y >= 0 && y < ground) fx(x, y, mix(get(x, y), 0xffffff, (1 - j / len) * (1 - light * 2) * (1 - t * 0.5)))
      }
    }
  }

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

/** The Dyson swarm, drawn over the clouds: a ring of mirrors round the sun by day, a glinting band by night. */
export function drawSwarm(cv: Canvas, c: City, sun: { x: number; y: number } | undefined, overcast: number) {
  if (!owns(c, 'dyson')) return
  const { W, fx, get, now, ground } = cv
  const secs = now / 1000
  const clear = 1 - overcast * 0.6
  const dot = (x: number, y: number, col: number, a: number) => {
    if (x >= 0 && x < W && y >= 0 && y < ground) fx(x, y, mix(get(x, y), col, a * clear))
  }

  if (sun) {
    const orbit = (ang: number, r: number) => ({ x: Math.round(sun.x + Math.cos(ang) * r), y: Math.round(sun.y + Math.sin(ang) * r * 0.45 + Math.cos(ang) * 1.5) })
    for (let k = 0; k < 48; k++) {
      const p = orbit((k / 48) * Math.PI * 2, 8)
      dot(p.x, p.y, 0xc8e8ff, 0.18)
    }
    for (let k = 0; k < 16; k++) {
      const ang = secs / 6 + (k / 16) * Math.PI * 2
      const p = orbit(ang, 8 + (k % 3) - 1)
      const isNear = Math.sin(ang) > 0
      const isGlint = (Math.floor(now / 250) + k * 5) % 16 === 0
      dot(p.x, p.y, isGlint ? 0xffffff : 0xa8f0ff, isNear ? 0.95 : 0.45)
    }
    return
  }

  // Night: the mirrors still catch the sun below the horizon, a sweep of light running along their band.
  const sweep = (secs / 9) % 1.4 - 0.2
  for (let k = 0; k < 36; k++) {
    const t = ((k + hash(k, 93)) / 36 + secs / 400) % 1
    const x = Math.round(t * W)
    const y = Math.round(ground * (0.1 + t * 0.2) + (hash(k, 94) - 0.5) * 3)
    const lit = Math.max(0, 1 - Math.abs(t - sweep) * 12)
    dot(x, y, lit > 0.3 ? 0xffffff : 0x9fdcff, 0.35 + lit * 0.6)
  }
}
