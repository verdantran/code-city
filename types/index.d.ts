export type Kind = 'house' | 'shop' | 'apartment' | 'tower' | 'factory' | 'civic' | 'landmark' | 'park' | 'special'

export type ItemId =
  | 'trees'
  | 'lamps'
  | 'balloon'
  | 'airport'
  | 'plaza'
  | 'ferris'
  | 'stadium'
  | 'needle'
  | 'rocket'
  | 'brickworks'
  | 'cityhall'
  | 'express'
  | 'monorail'
  | 'airship'
  | 'biodome'
  | 'supertall'
  | 'station'
  | 'moonbase'
  | 'elevator'
  | 'ring'

export type Building = {
  id: number
  x: number
  w: number
  kind: Kind
  floors: number
  target: number
  hue: number
  special?: ItemId
}

export type City = {
  founded: number
  bricks: number
  citizens: number
  power: number
  parks: number
  edits: number
  prompts: number
  commands: number
  nextId: number
  fireworksUntil: number
  tunnel?: number
  tunnel2?: number
  showerUntil?: number
  rainbowUntil?: number
  tokens?: number
  spent?: number
  owned?: ItemId[]
  rev?: number
  project?: string
  applied?: Record<string, { ledger: Ledger; at: number }>
  buildings: Building[]
}

/** One session's running totals of what it has earned, which the mayor folds into the city. */
export type Ledger = {
  tokens: number
  bricks: number
  citizens: number
  power: number
  parks: number
  edits: number
  prompts: number
  commands: number
  fireworksUntil: number
  rainbowUntil: number
  showerUntil: number
  purchases: ItemId[]
}

export type AgentView = { id: string; type: string; description: string; status: string }

/** A running subagent as other sessions see it: what kind, and whether it is busy. */
export type NeighbourAgent = { type: string; status: string }

/** Another session's presence file: what the game draws, and nothing about the work itself. */
export type Neighbour = {
  id: string
  slug: string
  project: string
  isBusy: boolean
  tier: string
  skyline: number[]
  agents: NeighbourAgent[]
}

/** One city on the map: its save, its name, and whether a session is building it now. */
export type District = {
  slug: string
  name: string
  city: City
  isHere: boolean
  isBusy: boolean
  agents: NeighbourAgent[]
}

export type LogLine = { at: number; text: string }

export type View = 'street' | 'map'

export type Scene = { agents: AgentView[]; neighbours: Neighbour[] }

declare module 'claude-code' {
  interface PluginState {
    'code-city': { city: City; log: LogLine[]; view: View; zoom: number; districts: District[]; drones: AgentView[]; nearby: Neighbour[]; self: string; isShopOpen: boolean; ledger: Ledger; sessionsHere: number }
  }
}
