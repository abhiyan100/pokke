import type { Snip } from '@shared/types'

/** Every word of the query must appear somewhere in the snip. */
export function searchSnips(snips: Snip[], query: string): Snip[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return snips
  return snips.filter((snip) => {
    const haystack = [snip.title, snip.note, snip.summary, snip.extractedText, snip.prompt, snip.pocket, ...snip.tags]
      .join('\n')
      .toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}

/** The most used tags in a list, most common first. */
export function commonTags(snips: Snip[], limit = 8): string[] {
  const counts = new Map<string, number>()
  for (const snip of snips) for (const tag of snip.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag)
}

/** What to call a snip in a list: its title, else the note, else a placeholder. */
export function snipLabel(snip: Snip): string {
  return snip.title || snip.note || 'Untitled snip'
}

const DAY = 86_400_000

export function formatWhen(timestamp: number, now = Date.now()): string {
  const elapsed = now - timestamp
  if (elapsed < 60_000) return 'Just now'
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min ago`
  if (elapsed < DAY) return `${Math.floor(elapsed / 3_600_000)} h ago`
  if (elapsed < 2 * DAY) return 'Yesterday'
  return new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/**
 * Other snips that share tags with this one: most shared tags first, then
 * the same pocket, then newest. A snip with no tags has nothing like it yet.
 */
export function relatedSnips(snip: Snip, all: Snip[], limit = 4): Snip[] {
  const tags = new Set(snip.tags)
  return all
    .filter((other) => other.id !== snip.id)
    .map((other) => ({ other, shared: other.tags.filter((tag) => tags.has(tag)).length }))
    .filter(({ shared }) => shared > 0)
    .sort(
      (a, b) =>
        b.shared - a.shared ||
        Number(b.other.pocket === snip.pocket) - Number(a.other.pocket === snip.pocket) ||
        b.other.createdAt - a.other.createdAt
    )
    .slice(0, limit)
    .map(({ other }) => other)
}
