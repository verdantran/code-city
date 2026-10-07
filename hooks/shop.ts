import type { Building, City, ItemId } from '../types'

export type Item = {
  id: ItemId
  name: string
  price: number
  blurb: string
  kind: 'street' | 'sky' | 'landmark' | 'upgrade'
  width?: number
}

export const CATALOG: Item[] = [
  { id: 'trees', name: 'Street trees', price: 150_000, kind: 'street', blurb: 'Trees line the pavement and turn with the seasons' },
  { id: 'brickworks', name: 'Brickworks', price: 300_000, kind: 'upgrade', blurb: 'Edits and new files earn 50% more bricks' },
  { id: 'lamps', name: 'Street lamps', price: 250_000, kind: 'street', blurb: 'Lamps glow along the pavement at night' },
  { id: 'balloon', name: 'Hot-air balloon', price: 400_000, kind: 'sky', blurb: 'A striped balloon drifts over the rooftops' },
  { id: 'plaza', name: 'Fountain plaza', price: 600_000, kind: 'landmark', width: 9, blurb: 'A paved square with a fountain and benches' },
  { id: 'cityhall', name: 'City hall', price: 800_000, kind: 'upgrade', blurb: 'Doubles the bricks the city earns while idle' },
  { id: 'express', name: 'Express subway', price: 1_000_000, kind: 'upgrade', blurb: 'Tunnels dig twice as fast, trains run faster' },
  { id: 'ferris', name: 'Ferris wheel', price: 1_200_000, kind: 'landmark', width: 13, blurb: 'A turning wheel that lights up at night' },
  { id: 'airport', name: 'Airport', price: 2_000_000, kind: 'sky', blurb: 'Planes cross the sky, leaving contrails' },
  { id: 'stadium', name: 'Stadium', price: 3_000_000, kind: 'landmark', width: 18, blurb: 'A roaring crowd under floodlights' },
  { id: 'needle', name: 'Observation tower', price: 4_000_000, kind: 'landmark', width: 5, blurb: 'A needle with a glowing sky deck' },
  { id: 'rocket', name: 'Rocket pad', price: 8_000_000, kind: 'landmark', width: 7, blurb: 'Launches a rocket every few minutes' },
  { id: 'monorail', name: 'Monorail', price: 15_000_000, kind: 'sky', blurb: 'An elevated train glides through the skyline' },
  { id: 'airship', name: 'Airship', price: 25_000_000, kind: 'sky', blurb: 'A silver blimp with a glowing banner at night' },
  { id: 'biodome', name: 'Glass biodome', price: 40_000_000, kind: 'landmark', width: 15, blurb: 'A glass greenhouse dome full of plants' },
  { id: 'supertall', name: 'Supertall', price: 75_000_000, kind: 'landmark', width: 9, blurb: 'A tiered skyscraper with a colour-changing crown' },
  { id: 'station', name: 'Space station', price: 150_000_000, kind: 'sky', blurb: 'Crosses the sky with its solar panels gleaming' },
  { id: 'moonbase', name: 'Moon base', price: 300_000_000, kind: 'sky', blurb: 'Lights on the moon, and a shuttle to reach it' },
  { id: 'elevator', name: 'Space elevator', price: 500_000_000, kind: 'landmark', width: 5, blurb: 'A tether into the sky with a climber riding it' },
  { id: 'ring', name: 'Orbital ring', price: 1_000_000_000, kind: 'sky', blurb: 'A luminous ring arcs across the whole sky' },
]

/** The most buildings a city keeps; the sanitizer drops any past it, so landmarks stop here. */
export const MAX_BUILDINGS = 400

export const itemOf = (id: ItemId) => CATALOG.find(i => i.id === id)
export const owns = (c: City, id: ItemId) => (c.owned ?? []).includes(id)
export const balanceOf = (c: City) => (c.tokens ?? 0) - (c.spent ?? 0)

/** Tokens a turn counts for: cache reads are billed at a tenth, so they count a tenth. */
export function weighTokens(u: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number }) {
  const n = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)
  return n(u.input_tokens) + n(u.output_tokens) + n(u.cache_creation_input_tokens) + Math.round(n(u.cache_read_input_tokens) / 10)
}

const trim = (n: number, digits: number) => `${Number(n.toFixed(digits))}`

export function formatTokens(n: number) {
  if (n >= 1_000_000_000) return `${trim(n / 1_000_000_000, n >= 10_000_000_000 ? 0 : 1)}B`
  if (n >= 1_000_000) return `${trim(n / 1_000_000, n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return `${Math.round(n)}`
}

/** Lays buildings out left to right again, one pixel apart, keeping their order. */
function relayout(buildings: Building[]) {
  let x = 0
  return buildings.map(b => {
    const placed = { ...b, x }
    x += b.w + 1
    return placed
  })
}

export type Purchase = { city: City; error?: undefined } | { city?: undefined; error: string }

export function buy(c: City, id: ItemId): Purchase {
  const item = itemOf(id)
  if (!item) return { error: `There is no ${id} for sale.` }
  if (owns(c, id)) return { error: `The city already has ${item.name.toLowerCase()}.` }
  const short = item.price - balanceOf(c)
  if (short > 0) return { error: `${item.name} needs ${formatTokens(short)} more tokens.` }
  if (item.kind === 'landmark' && c.buildings.length >= MAX_BUILDINGS) return { error: 'The city has no room left for another landmark.' }

  const next: City = { ...c, spent: (c.spent ?? 0) + item.price, owned: [...(c.owned ?? []), id] }
  if (item.kind !== 'landmark' || !item.width) return { city: next }

  const special: Building = { id: c.nextId, x: 0, w: item.width, kind: 'special', special: id, floors: 0, target: 1, hue: 0 }
  const at = Math.floor(c.buildings.length / 2)
  return {
    city: {
      ...next,
      nextId: c.nextId + 1,
      buildings: relayout([...c.buildings.slice(0, at), special, ...c.buildings.slice(at)]),
    },
  }
}
