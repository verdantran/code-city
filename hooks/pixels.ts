/** Pixel rows of pavement under the buildings, and of pavement plus road. */
export const PAVEMENT = 3
export const STREET = PAVEMENT + 2

export function hash(...n: number[]) {
  let h = 2166136261
  for (const v of n) {
    h = Math.imul(h ^ (v | 0), 16777619)
    h ^= h >>> 13
  }
  return ((h >>> 0) % 100000) / 100000
}

export const hashStr = (s: string) => hash(...Array.from(s, ch => ch.charCodeAt(0)))

const rgb = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b
const ch = (c: number, s: number) => (c >> s) & 255
export function mix(a: number, b: number, t: number) {
  const k = Math.max(0, Math.min(1, t))
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * k)
  return rgb(m(16), m(8), m(0))
}
