/**
 * The pockets a snip can be filed into. The AI must choose one of these ids;
 * `holds` is the description it is given, so wording here changes how snips
 * get sorted.
 */
export const POCKET_IDS = ['design', 'prompts', 'ideas', 'code', 'reads', 'tools', 'loose'] as const

export type PocketId = (typeof POCKET_IDS)[number]

/** Sashiko stitch pattern that identifies a pocket in the UI. */
export type PatternId = 'asanoha' | 'yabane' | 'seigaiha' | 'igeta' | 'shima' | 'shippo' | 'juji'

export interface Pocket {
  id: PocketId
  name: string
  pattern: PatternId
  holds: string
}

export const POCKETS: readonly Pocket[] = [
  {
    id: 'design',
    name: 'Design',
    pattern: 'asanoha',
    holds:
      'Interfaces, layouts, typography, colour, motion, illustration, branding: anything kept for how it looks or feels.'
  },
  {
    id: 'prompts',
    name: 'Prompts',
    pattern: 'yabane',
    holds:
      'Prompts, system prompts, or instructions written for an AI model, usually visible as text in the image.'
  },
  {
    id: 'ideas',
    name: 'Ideas',
    pattern: 'shippo',
    holds: 'Product ideas, concepts, strategies, brainstorm material, things to try or build.'
  },
  {
    id: 'code',
    name: 'Code',
    pattern: 'igeta',
    holds: 'Code snippets, terminal commands, configuration, technical how-tos.'
  },
  {
    id: 'reads',
    name: 'Reads',
    pattern: 'shima',
    holds: 'Articles, threads, quotes, charts, facts and arguments worth remembering.'
  },
  {
    id: 'tools',
    name: 'Tools',
    pattern: 'seigaiha',
    holds: 'Apps, libraries, services, or products to check out later.'
  },
  {
    id: 'loose',
    name: 'Loose',
    pattern: 'juji',
    holds: 'Anything that fits none of the other pockets.'
  }
]

const BY_ID = new Map(POCKETS.map((pocket) => [pocket.id, pocket]))

export function pocketById(id: PocketId): Pocket {
  // POCKETS covers every PocketId, so the lookup cannot miss.
  return BY_ID.get(id)!
}

export function isPocketId(value: unknown): value is PocketId {
  return typeof value === 'string' && BY_ID.has(value as PocketId)
}
