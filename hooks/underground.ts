import type { City } from '../types'
import type { Canvas } from './buildings'
import { hash, mix, STREET } from './pixels'
import { owns } from './shop'

export const SUBWAY_AT = 80
export const SECOND_LINE_AT = 300
export const TRAINS_AT = 24
const STATION_EVERY = 40
const LINES = [
  { color: 0xe04040, firstStation: 14, speed: 13 },
  { color: 0x3f8fe0, firstStation: 34, speed: 10 },
]

export const MAX_TUNNEL = 1000
const tunnelOf = (n: number | undefined) => (Number.isFinite(n) ? Math.min(MAX_TUNNEL, Math.max(0, n ?? 0)) : 0)
export const lengthsOf = (c: City) => [tunnelOf(c.tunnel), tunnelOf(c.tunnel2)]

export function stationsOf(c: City) {
  return lengthsOf(c).reduce((n, len, i) => {
    const first = LINES[i]?.firstStation ?? 0
    return n + (len >= first + 8 ? Math.floor((len - first - 8) / STATION_EVERY) + 1 : 0)
  }, 0)
}

/** World x of each Red Line street entrance. */
export function entrancesOf(c: City) {
  const xs: number[] = []
  const first = LINES[0]?.firstStation ?? 0
  const [len = 0] = lengthsOf(c)
  for (let sx = first; sx + 8 <= len; sx += STATION_EVERY) xs.push(sx + 1)
  return xs
}

/** Rows the underground needs below the road, given the pixel height on offer. */
export function depthOf(c: City, H: number) {
  const [one = 0, two = 0] = lengthsOf(c)
  if (one <= 0 || H < 28) return 0
  return two > 0 && H >= 36 ? 12 : 7
}

export function drawUnderground(cv: Canvas, c: City, off: number, depth: number, reach: number) {
  const { set, W, now } = cv
  const top = cv.ground + STREET
  for (let y = top; y < top + depth; y++)
    for (let x = 0; x < W; x++) {
      const wx = x - off
      const soil = mix(0x5a4030, 0x2e2018, (y - top) / depth)
      set(x, y, hash(wx, y, 5) > 0.88 ? mix(soil, 0x9a8a70, 0.35) : soil)
    }

  lengthsOf(c).forEach((len, i) => {
    const line = LINES[i]
    if (!line || len <= 0 || (i === 1 && depth < 12)) return
    const ceiling = top + 1 + i * 5
    const end = off + len

    for (let x = Math.max(0, off); x < Math.min(W, end); x++) {
      const wx = x - off
      set(x, ceiling, 0x3a3a40)
      set(x, ceiling + 1, wx % 6 === 0 ? 0x6a6040 : 0x1c1c22)
      set(x, ceiling + 2, 0x1c1c22)
      set(x, ceiling + 3, wx % 2 ? 0x707070 : 0x4a3a2a)
    }

    for (let sx = line.firstStation; sx + 8 <= len; sx += STATION_EVERY) {
      const x0 = sx + off
      for (let x = x0; x < x0 + 8; x++) {
        set(x, ceiling, line.color)
        set(x, ceiling + 1, 0xe8e0c8)
        set(x, ceiling + 2, 0xd8d0b8)
      }
      if (i === 0) {
        set(x0 + 1, top, 0xc8c0a8)
        set(x0 + 2, top, 0xc8c0a8)
        set(x0, cv.ground, line.color)
        set(x0 + 1, cv.ground + 2, 0x202024)
        set(x0 + 2, cv.ground + 2, 0x202024)
      } else {
        for (let y = top; y < ceiling; y++) if (y < top + 1 || y > top + 4) set(x0 + 6, y, 0xc8c0a8)
      }
    }

    if (len < reach) {
      const spin = Math.floor(now / 150) % 2
      set(end, ceiling, 0xf2b33d)
      set(end, ceiling + 1, spin ? 0x3a3a3a : 0xf2b33d)
      set(end, ceiling + 2, spin ? 0xf2b33d : 0x3a3a3a)
      set(end, ceiling + 3, 0xf2b33d)
      set(end - 1, ceiling + 1, 0xc08a20)
      set(end - 1, ceiling + 2, 0xc08a20)
      if (hash(Math.floor(now / 200), i) > 0.5) set(end + 1, ceiling + 1 + Math.floor(hash(now, 3) * 2), 0x9a8a70)
    }

    if (len < TRAINS_AT) return
    const trains = 1 + Math.floor(len / 90)
    const carLen = 7
    const span = Math.max(1, len - carLen - 1)
    for (let t = 0; t < trains; t++) {
      const travel = (hash(t, i, 17) * span * 2 + (now / 1000) * line.speed * (owns(c, 'express') ? 1.6 : 1)) % (span * 2)
      const isOutbound = travel < span
      const start = off + Math.round(isOutbound ? travel : span * 2 - travel)
      for (let k = 0; k < carLen; k++) {
        const x = start + k
        const isFront = isOutbound ? k === carLen - 1 : k === 0
        const isWindow = k % 2 === 1 && !isFront
        set(x, ceiling + 1, isFront ? 0xfff4b0 : isWindow ? 0xfff0b0 : line.color)
        set(x, ceiling + 2, k === 3 ? mix(line.color, 0x000000, 0.5) : mix(line.color, 0x000000, 0.25))
      }
    }
  })
}
