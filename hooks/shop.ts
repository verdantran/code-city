import type { Building, City, ItemId } from '../types'

export type Item = {
  id: ItemId
  name: string
  price: number
  blurb: string
  kind: 'street' | 'sky' | 'landmark' | 'upgrade'
  width?: number
  /** Presses its buy button while the pane has the keyboard; fixed per item, so a purchase never moves another's. */
  hotkey: string
}

/** Keys the pane's own buttons hold: shop, view and zoom. */
export const RESERVED_KEYS = ['s', 'v', 'z']

export const CATALOG: Item[] = [
  { id: 'flowers', name: 'Flower beds', price: 25_000, hotkey: '6', kind: 'street', blurb: 'Little beds of flowers along the pavement' },
  { id: 'birds', name: 'Songbirds', price: 40_000, hotkey: '7', kind: 'sky', blurb: 'Flocks of birds flap across the daytime sky' },
  { id: 'benches', name: 'Benches', price: 60_000, hotkey: '8', kind: 'street', blurb: 'Places to sit along the pavement' },
  { id: 'foodtruck', name: 'Food truck', price: 90_000, hotkey: '9', kind: 'street', blurb: 'A food truck parks up, steam rising from its grill' },
  { id: 'bunting', name: 'Bunting', price: 120_000, hotkey: '0', kind: 'street', blurb: 'Strings of bright flags sway above the street' },
  { id: 'trees', name: 'Street trees', price: 150_000, hotkey: 'a', kind: 'street', blurb: 'Trees line the pavement and turn with the seasons' },
  { id: 'kites', name: 'Kites', price: 200_000, hotkey: 'w', kind: 'sky', blurb: 'Kites dance over the rooftops, tails streaming' },
  { id: 'brickworks', name: 'Brickworks', price: 300_000, hotkey: 'b', kind: 'upgrade', blurb: 'Edits and new files earn 50% more bricks' },
  { id: 'lamps', name: 'Street lamps', price: 250_000, hotkey: 'c', kind: 'street', blurb: 'Lamps glow along the pavement at night' },
  { id: 'balloon', name: 'Hot-air balloon', price: 400_000, hotkey: 'd', kind: 'sky', blurb: 'A striped balloon drifts over the rooftops' },
  { id: 'plaza', name: 'Fountain plaza', price: 600_000, hotkey: 'e', kind: 'landmark', width: 9, blurb: 'A paved square with a fountain and benches' },
  { id: 'lighthouse', name: 'Lighthouse', price: 700_000, hotkey: 'x', kind: 'landmark', width: 5, blurb: 'A striped lighthouse whose beam sweeps the night' },
  { id: 'cityhall', name: 'City hall', price: 800_000, hotkey: 'f', kind: 'upgrade', blurb: 'Doubles the bricks the city earns while idle' },
  { id: 'express', name: 'Express subway', price: 1_000_000, hotkey: 'g', kind: 'upgrade', blurb: 'Tunnels dig twice as fast, trains run faster' },
  { id: 'ferris', name: 'Ferris wheel', price: 1_200_000, hotkey: 'h', kind: 'landmark', width: 13, blurb: 'A turning wheel that lights up at night' },
  { id: 'turbine', name: 'Wind turbine', price: 1_500_000, hotkey: 'y', kind: 'landmark', width: 9, blurb: 'Tall white blades turning in the breeze' },
  { id: 'airport', name: 'Airport', price: 2_000_000, hotkey: 'i', kind: 'sky', blurb: 'Planes cross the sky, leaving contrails' },
  { id: 'stadium', name: 'Stadium', price: 3_000_000, hotkey: 'j', kind: 'landmark', width: 18, blurb: 'A roaring crowd under floodlights' },
  { id: 'needle', name: 'Observation tower', price: 4_000_000, hotkey: 'k', kind: 'landmark', width: 5, blurb: 'A needle with a glowing sky deck' },
  { id: 'castle', name: 'Castle', price: 5_000_000, hotkey: '1', kind: 'landmark', width: 11, blurb: 'Battlements, towers and a flag on the keep' },
  { id: 'rocket', name: 'Rocket pad', price: 8_000_000, hotkey: 'l', kind: 'landmark', width: 7, blurb: 'Launches a rocket every few minutes' },
  { id: 'pyramid', name: 'Glass pyramid', price: 10_000_000, hotkey: '2', kind: 'landmark', width: 13, blurb: 'A glass pyramid that shines a beam skyward at night' },
  { id: 'monorail', name: 'Monorail', price: 15_000_000, hotkey: 'm', kind: 'sky', blurb: 'An elevated train glides through the skyline' },
  { id: 'airship', name: 'Airship', price: 25_000_000, hotkey: 'n', kind: 'sky', blurb: 'A silver blimp with a glowing banner at night' },
  { id: 'biodome', name: 'Glass biodome', price: 40_000_000, hotkey: 'o', kind: 'landmark', width: 15, blurb: 'A glass greenhouse dome full of plants' },
  { id: 'meteors', name: 'Meteor shower', price: 60_000_000, hotkey: '3', kind: 'sky', blurb: 'Shooting stars streak across the night sky' },
  { id: 'supertall', name: 'Supertall', price: 75_000_000, hotkey: 'p', kind: 'landmark', width: 9, blurb: 'A tiered skyscraper with a colour-changing crown' },
  { id: 'ufo', name: 'Flying saucer', price: 100_000_000, hotkey: '4', kind: 'sky', blurb: 'Visitors hover over the city now and then, beam glowing' },
  { id: 'station', name: 'Space station', price: 150_000_000, hotkey: 'q', kind: 'sky', blurb: 'Crosses the sky with its solar panels gleaming' },
  { id: 'moonbase', name: 'Moon base', price: 300_000_000, hotkey: 'r', kind: 'sky', blurb: 'Lights on the moon, and a shuttle to reach it' },
  { id: 'elevator', name: 'Space elevator', price: 500_000_000, hotkey: 't', kind: 'landmark', width: 5, blurb: 'A tether into the sky with a climber riding it' },
  { id: 'ring', name: 'Orbital ring', price: 1_000_000_000, hotkey: 'u', kind: 'sky', blurb: 'A luminous ring arcs across the whole sky' },
  { id: 'dyson', name: 'Dyson swarm', price: 2_000_000_000, hotkey: '5', kind: 'sky', blurb: 'Mirrors circle the sun by day and glint among the stars by night' },
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
