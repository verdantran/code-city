import type { City } from '../types'
import { hash, mix } from './pixels'
import type { Weather } from './weather'

export type Street = {
  W: number
  ground: number
  now: number
  isNight: boolean
  shade: (col: number) => number
  set: (x: number, y: number, col: number) => void
}

const CLOTHES = [0xd94040, 0x3f6fd9, 0x40a060, 0xe0a030, 0x9a50c0, 0x2a2a35, 0xe8e8e8, 0x4fa3a3, 0xd060a0]
const SKIN = [0xf2d0b0, 0xd8a880, 0xb07850, 0x7a5030, 0x5a3a24]
const UMBRELLAS = [0xd94040, 0x3f6fd9, 0xf2d24a, 0x40a060, 0x2a2a35, 0xff70b0]
const MAX_WALKERS = 40
const COMMUTERS = 4

const pick = (list: number[], roll: number) => list[Math.floor(roll * list.length)] ?? list[0] ?? 0

type Figure = { x: number; seed: number; isMoving: boolean; dir: number; secs: number }

function drawFigure(st: Street, w: Weather, f: Figure) {
  const { ground, set, shade } = st
  const body = shade(pick(CLOTHES, hash(f.seed, 1)))
  const legs = mix(body, 0x101018, 0.45)
  const step = f.isMoving && Math.floor(f.secs * 4 + f.seed) % 2 === 1 ? f.dir : 0
  set(f.x, ground, shade(pick(SKIN, hash(f.seed, 2))))
  set(f.x, ground + 1, body)
  set(f.x + step, ground + 2, legs)

  const isRaining = (w.kind === 'rain' || w.kind === 'storm') && w.intensity > 0.2
  if (isRaining && hash(f.seed, 3) < 0.65) {
    const brolly = shade(pick(UMBRELLAS, hash(f.seed, 4)))
    for (let dx = -1; dx <= 1; dx++) set(f.x + dx, ground - 1, brolly)
  }
  if (hash(f.seed, 5) < 0.12) set(f.x + f.dir * 2, ground + 2, shade(hash(f.seed, 6) < 0.5 ? 0x8a5a3a : 0xe8e0d0))
}

/** Pedestrians on the pavement, drawn in screen space like the traffic. */
export function drawPeople(st: Street, c: City, w: Weather, entrances: number[], off: number) {
  const { W, now, isNight } = st
  const secs = now / 1000
  const isWet = w.kind === 'rain' || w.kind === 'storm'
  const weatherFactor = { clear: 1, cloudy: 0.95, fog: 0.8, rain: 0.7, storm: 0.4, snow: 0.6 }[w.kind]
  const outside = (isNight ? 0.35 : 1) * (1 - (1 - weatherFactor) * w.intensity)
  const crowd = Math.min(MAX_WALKERS, Math.max(1, Math.round(c.citizens / 6)))
  const hurry = isWet && w.intensity > 0.2 ? 1.6 : 1
  const loop = W + 6

  for (let i = 0; i < crowd; i++) {
    if (hash(i, 11) > outside) continue
    const seed = i * 7 + 3
    const dir = hash(i, 12) < 0.5 ? 1 : -1
    const speed = (2 + hash(i, 13) * 3) * hurry
    const cycle = 10 + hash(i, 14) * 8
    const pause = hash(i, 15) < 0.5 ? 1.5 + hash(i, 16) * 2.5 : 0
    const walking = cycle - pause
    const inCycle = secs % cycle
    const walked = Math.floor(secs / cycle) * walking + Math.min(inCycle, walking)
    const pos = (hash(i, 17) * loop + walked * speed) % loop
    const x = Math.round(dir > 0 ? pos - 3 : W + 2 - pos)
    drawFigure(st, w, { x, seed, isMoving: inCycle < walking, dir, secs })
  }

  entrances.forEach((ex, s) => {
    const period = 22 + hash(s, 21) * 10
    const since = (secs + hash(s, 22) * period) % period
    if (since > 7) return
    for (let k = 0; k < COMMUTERS; k++) {
      const delay = k * 0.7
      if (since < delay) continue
      const dir = hash(s, k, 23) < 0.5 ? 1 : -1
      const x = Math.round(ex + off + dir * (since - delay) * (2.5 + hash(s, k, 24) * 1.5))
      drawFigure(st, w, { x, seed: 1000 + s * 10 + k, isMoving: true, dir, secs })
    }
  })

  if (now < c.fireworksUntil) {
    for (let k = 0; k < 10; k++) {
      const x = Math.round(hash(k, 31) * W)
      drawFigure(st, w, { x, seed: 2000 + k, isMoving: false, dir: 1, secs })
    }
  }
}
