import type { City } from '../types'
import { hash, mix, PAVEMENT, STREET } from './pixels'

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog'
type Season = 'winter' | 'spring' | 'summer' | 'autumn'

export type Weather = {
  kind: WeatherKind
  season: Season
  slot: number
  intensity: number
  wind: number
  overcast: number
  snow: number
  wet: number
  rainbow: number
  aurora: number
}

export type Sky = {
  W: number
  ground: number
  now: number
  light: number
  isNight: boolean
  set: (x: number, y: number, col: number) => void
  get: (x: number, y: number) => number
}

const SLOT_MS = 150_000
export const WEATHER_CHANCE = 0.25
const RAMP = 0.2
const CHANCES: Record<Season, Record<Exclude<WeatherKind, 'clear'>, number>> = {
  winter: { cloudy: 25, rain: 12, storm: 3, snow: 45, fog: 15 },
  spring: { cloudy: 30, rain: 40, storm: 10, snow: 3, fog: 17 },
  summer: { cloudy: 35, rain: 30, storm: 25, snow: 0, fog: 10 },
  autumn: { cloudy: 30, rain: 38, storm: 10, snow: 4, fog: 18 },
}
const OVERCAST: Record<WeatherKind, number> = { clear: 0, cloudy: 0.35, rain: 0.55, storm: 0.8, snow: 0.45, fog: 0.5 }
const isWet = (k: WeatherKind) => k === 'rain' || k === 'storm'

function seasonOf(now: number): Season {
  const month = new Date(now).getMonth()
  if (month === 11 || month <= 1) return 'winter'
  if (month <= 4) return 'spring'
  if (month <= 7) return 'summer'
  return 'autumn'
}

const rolls = (slot: number) => hash(slot, 40) < WEATHER_CHANCE

/** Most spells are clear, and a spell of weather is never followed by another. */
function kindOf(slot: number, season: Season): WeatherKind {
  if (!rolls(slot) || rolls(slot - 1)) return 'clear'
  const entries = Object.entries(CHANCES[season]) as [WeatherKind, number][]
  let left = hash(slot, 41) * entries.reduce((n, [, w]) => n + w, 0)
  for (const [kind, w] of entries) if ((left -= w) < 0) return kind
  return 'clear'
}

export function weatherAt(now: number, c: City): Weather {
  const slot = Math.floor(now / SLOT_MS)
  const t = (now % SLOT_MS) / SLOT_MS
  const season = seasonOf(now)
  const prev = kindOf(slot - 1, season)
  let kind = kindOf(slot, season)
  let intensity = kind === 'clear' ? 0 : Math.min(1, t / RAMP, (1 - t) / RAMP) * (0.4 + 0.4 * hash(slot, 43))

  const shower = (c.showerUntil ?? 0) - now
  if (shower > 0 && kind !== 'storm' && kind !== 'snow' && (c.rainbowUntil ?? 0) <= now) {
    kind = 'rain'
    intensity = Math.max(intensity, 0.35 * Math.min(1, shower / 4000))
  }

  const rainbowFor = (c.rainbowUntil ?? 0) - now
  const afterRain = isWet(prev) && (kind === 'clear' || kind === 'cloudy') ? Math.min(1, t / 0.08) * Math.max(0, Math.min(1, (0.45 - t) / 0.25)) : 0

  return {
    kind,
    season,
    slot,
    intensity,
    wind: (hash(slot, 44) * 2 - 1) * (kind === 'storm' ? 1 : 0.5),
    overcast: OVERCAST[kind] * intensity,
    snow: kind === 'snow' ? Math.min(1, t * 2.5) : prev === 'snow' ? Math.max(0, 1 - t * 3) : 0,
    wet: isWet(kind) ? Math.min(1, intensity * 1.5) : isWet(prev) ? Math.max(0, 1 - t * 2.5) : 0,
    rainbow: rainbowFor > 0 ? Math.min(1, rainbowFor / 3000) : afterRain,
    aurora: kind === 'clear' && hash(slot, 45) < (season === 'winter' ? 0.6 : 0.2) ? 1 : 0,
  }
}

export function weatherLabel(w: Weather, isNight: boolean) {
  if (w.kind === 'clear') {
    if (w.rainbow > 0.3) return 'rainbow'
    if (w.aurora && isNight) return 'aurora'
    return isNight ? 'clear night' : 'sunny'
  }
  const words: Record<WeatherKind, string> = {
    clear: 'clear',
    cloudy: 'cloudy',
    rain: w.intensity > 0.75 ? 'pouring' : 'raining',
    storm: 'thunderstorm',
    snow: w.intensity > 0.75 ? 'blizzard' : 'snowing',
    fog: 'foggy',
  }
  return words[w.kind]
}

/** Tints a sky colour toward overcast grey. */
export const overcastTint = (col: number, w: Weather, light: number) => mix(col, mix(0x1a1e26, 0x7a828e, light), w.overcast)

export function drawAurora(sky: Sky, w: Weather) {
  if (!w.aurora || sky.light > 0.25) return
  const { W, now, set, get } = sky
  const strength = Math.min(1, ((0.25 - sky.light) / 0.25) * 1.6)
  for (let x = 0; x < W; x++) {
    const centre = 3 + Math.sin(x / 7 + now / 2600) * 2 + Math.sin(x / 3.1 + now / 1700)
    const curtain = 0.5 + 0.5 * Math.sin(x / 2.3 + now / 900)
    const col = mix(0x40ff9a, 0xa060ff, 0.5 + 0.5 * Math.sin(x / 17 + now / 5000))
    for (let dy = 0; dy < 5; dy++) {
      const y = Math.round(centre) + dy
      if (y < 0 || y >= sky.ground) continue
      set(x, y, mix(get(x, y), col, strength * curtain * 0.8 * (1 - dy / 5)))
    }
  }
}

export function drawRainbow(sky: Sky, w: Weather) {
  if (w.rainbow <= 0 || sky.light < 0.5) return
  const { W, ground, set, get } = sky
  const bands = [0xff4040, 0xff9a40, 0xffe040, 0x50d050, 0x4090ff, 0x8050d0]
  const cx = Math.round(W * 0.68)
  const cy = ground + 4
  const r0 = Math.min(W * 0.45, ground * 1.1)
  for (let x = 0; x < W; x++)
    bands.forEach((col, i) => {
      const r = r0 - i
      const dx = x - cx
      if (Math.abs(dx) > r) return
      const y = Math.round(cy - Math.sqrt(r * r - dx * dx) * 0.8)
      if (y >= 0 && y < ground) set(x, y, mix(get(x, y), col, 0.4 * w.rainbow))
    })
}

export function drawClouds(sky: Sky, w: Weather) {
  const { W, ground, now, light, set, get } = sky
  const counts: Record<WeatherKind, number> = { clear: 2, cloudy: 6, rain: 7, storm: 9, snow: 6, fog: 3 }
  const base: Record<WeatherKind, number> = { clear: 0xf4f6f8, cloudy: 0xe2e6ea, rain: 0x9aa2ae, storm: 0x4a505c, snow: 0xd8dde4, fog: 0xc8ccd2 }
  const tone = mix(mix(0x1c2030, base[w.kind], light), 0x10131c, w.kind === 'storm' ? 0.2 : 0)
  const n = Math.round(counts[w.kind] * (w.kind === 'clear' ? 1 : 0.4 + 0.6 * w.intensity))

  if (w.overcast > 0.3)
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < W; x++) set(x, y, mix(get(x, y), tone, (w.overcast - 0.3) * (1.4 - y * 0.35)))

  for (let i = 0; i < n; i++) {
    const cw = 7 + Math.round(hash(i, w.slot, 1) * 10)
    const loop = W + cw * 2
    const x0 = Math.round(((hash(i, 3) * loop + (now / 1000) * (1.2 + Math.abs(w.wind) * 4)) % loop) - cw)
    const y0 = 1 + Math.round(hash(i, 2) * ground * 0.3)
    const alpha = w.kind === 'clear' ? 0.6 : 0.88
    for (let r = 0; r < 3; r++) {
      const inset = r === 0 ? 2 + Math.round(hash(i, 4) * 2) : r === 1 ? 0 : 1
      for (let x = x0 + inset; x < x0 + cw - inset; x++) {
        if (r === 0 && hash(i, x) < 0.25) continue
        const y = y0 + r
        if (x < 0 || x >= W || y >= ground) continue
        set(x, y, mix(get(x, y), r === 2 ? mix(tone, 0x000000, 0.12) : tone, alpha))
      }
    }
  }
}

export function strikeAt(now: number, w: Weather) {
  if (w.kind !== 'storm' || w.intensity < 0.4) return undefined
  const id = Math.floor(now / 180)
  return hash(id, w.slot, 7) > 0.994 ? id : undefined
}

export function drawBolt(sky: Sky, w: Weather) {
  const id = strikeAt(sky.now, w)
  if (id === undefined) return
  let x = Math.round(hash(id, 1) * sky.W)
  for (let y = 0; y < sky.ground; y++) {
    sky.set(x, y, 0xfafaff)
    if (hash(id, y) > 0.55) x += hash(id, y, 2) > 0.5 ? 1 : -1
    if (hash(id, y, 3) > 0.9) sky.set(x + 1, y + 1, 0xc8d0ff)
  }
}

export function drawSnowCover(sky: Sky, w: Weather, roofTop: Int16Array, shade: (col: number) => number) {
  if (w.snow <= 0) return
  const cap = shade(0xf4f8ff)
  for (let x = 0; x < sky.W; x++) {
    const y = roofTop[x] ?? sky.ground
    if (y <= 0 || y >= sky.ground) continue
    if (w.snow > hash(x, 77) * 0.9) sky.set(x, y - 1, cap)
    if (w.snow > 0.7 && hash(x, 78) > 0.6) sky.set(x, y, cap)
  }
}

export function drawStreetWeather(sky: Sky, w: Weather) {
  const { W, ground, set, get, now } = sky
  for (let x = 0; x < W; x++) {
    if (w.snow > 0) {
      for (let y = ground; y < ground + PAVEMENT; y++)
        if (w.snow > hash(x, y, 79) * 0.8) set(x, y, mix(get(x, y), 0xeef2f8, 0.8))
      if (w.snow > hash(x, 80)) set(x, ground + STREET - 1, mix(get(x, ground + STREET - 1), 0xdfe4ec, 0.35))
    }
    if (w.wet > 0) {
      for (let y = ground; y < ground + PAVEMENT; y++) set(x, y, mix(get(x, y), 0x30343c, w.wet * 0.35))
      for (const y of [ground + PAVEMENT, ground + PAVEMENT + 1]) {
        const glint = hash(x, y, Math.floor(now / 1200)) > 0.86
        if (glint) set(x, y, mix(get(x, y), sky.isNight ? 0x8a8060 : 0xa8c0d8, 0.45 * w.wet))
      }
    }
  }
}

export function drawFog(sky: Sky, w: Weather) {
  if (w.kind !== 'fog' || w.intensity <= 0) return
  const { W, ground, now, light, set, get } = sky
  const fog = mix(0x2a2e38, 0xc8ccd2, light)
  for (let y = 0; y < ground + STREET; y++)
    for (let x = 0; x < W; x++) {
      const drift = 0.15 * Math.sin(x / 11 + now / 3000 + y / 3)
      set(x, y, mix(get(x, y), fog, w.intensity * (0.45 * (0.3 + 0.7 * (y / ground)) + drift * 0.6)))
    }
}

export function drawPrecipitation(sky: Sky, w: Weather) {
  const { W, ground, now, set, get } = sky
  const secs = now / 1000

  if (isWet(w.kind) && w.intensity > 0) {
    const heavy = w.kind === 'storm'
    const n = Math.round((w.intensity * W * ground) / (heavy ? 22 : 40))
    const lean = w.wind * (heavy ? 0.8 : 0.4)
    const fall = ground + 6
    for (let i = 0; i < n; i++) {
      const speed = (heavy ? 48 : 34) + hash(i, 1) * 14
      const y = Math.round(((hash(i, 2) * fall + secs * speed) % fall) - 3)
      const x = Math.round(hash(i, 3) * (W + 20) - 10 + y * lean)
      const drop = (px: number, py: number) => {
        if (px >= 0 && px < W && py >= 0 && py < ground) set(px, py, mix(get(px, py), 0xb8c8e0, 0.35))
      }
      drop(x, y)
      drop(x - Math.round(lean), y - 1)
      if (y >= ground - 1 && x >= 1 && x < W - 1) {
        set(x - 1, ground - 1, mix(get(x - 1, ground - 1), 0xd8e4f4, 0.3))
        set(x + 1, ground - 1, mix(get(x + 1, ground - 1), 0xd8e4f4, 0.3))
      }
    }
  }

  if (w.kind === 'snow' && w.intensity > 0) {
    const n = Math.round((w.intensity * W * ground) / 30)
    for (let i = 0; i < n; i++) {
      const speed = 3 + hash(i, 1) * 4 + w.intensity * 3
      const y = Math.round((hash(i, 2) * ground + secs * speed) % ground)
      const sway = Math.sin(secs * 1.3 + i) * 1.5 + secs * w.wind * 4
      const x = Math.round((((hash(i, 3) * W + sway) % W) + W) % W)
      set(x, y, mix(get(x, y), 0xffffff, 0.7))
    }
  }

  const drifting = (w.season === 'autumn' || w.season === 'spring') && (w.kind === 'clear' || w.kind === 'cloudy')
  if (drifting) {
    const colours = w.season === 'autumn' ? [0xe08030, 0xc0502a, 0xd8a030] : [0xf8c0d8, 0xffe0ee]
    const n = Math.round(W / 35)
    for (let i = 0; i < n; i++) {
      const y = Math.round((hash(i, 5) * ground + secs * (2 + hash(i, 6) * 2)) % ground)
      const x = Math.round((((hash(i, 7) * W + secs * (3 + w.wind * 6) + Math.sin(secs * 2 + i) * 2) % W) + W) % W)
      set(x, y, colours[i % colours.length] ?? 0xe08030)
    }
  }
}
