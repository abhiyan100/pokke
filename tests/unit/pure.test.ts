import { describe, expect, it } from 'vitest'
import { extractPalette } from '../../src/main/palette'
import { relatedSnips, searchSnips } from '../../src/renderer/src/library/snips'
import { adjustRect, isUsable, moveRect, placeNote, rectBetween } from '../../src/renderer/src/overlay/selection'
import { toastThumbBox } from '../../src/shared/toastLayout'
import type { Snip } from '../../src/shared/types'

const screen = { width: 1000, height: 600 }

describe('selection geometry', () => {
  it('gives the same rectangle whichever way the drag went, kept on screen', () => {
    expect(rectBetween({ x: 300, y: 200 }, { x: 100, y: 50 }, screen)).toEqual({ x: 100, y: 50, width: 200, height: 150 })
    expect(rectBetween({ x: -40, y: 550 }, { x: 60, y: 900 }, screen)).toEqual({ x: 0, y: 550, width: 60, height: 50 })
  })

  it('treats a stray click as no selection', () => {
    expect(isUsable(rectBetween({ x: 10, y: 10 }, { x: 13, y: 300 }, screen))).toBe(false)
    expect(isUsable(null)).toBe(false)
  })

  it('moves without leaving the screen and resizes from an edge or corner', () => {
    const rect = { x: 100, y: 100, width: 200, height: 100 }
    expect(moveRect(rect, 5000, -5000, screen)).toEqual({ x: 800, y: 0, width: 200, height: 100 })
    expect(adjustRect(rect, 'se', 50, 20, screen)).toEqual({ x: 100, y: 100, width: 250, height: 120 })
    // Dragging the left edge past the right one flips the selection.
    expect(adjustRect(rect, 'w', 260, 0, screen)).toEqual({ x: 300, y: 100, width: 60, height: 100 })
  })

  it('places the note below, then above, then inside the selection', () => {
    const bar = { width: 360, height: 54 }
    expect(placeNote({ x: 100, y: 100, width: 400, height: 200 }, screen, bar).side).toBe('below')
    expect(placeNote({ x: 100, y: 300, width: 400, height: 290 }, screen, bar).side).toBe('above')
    expect(placeNote({ x: 0, y: 0, width: 1000, height: 600 }, screen, bar).side).toBe('inside')
  })
})

describe('corner thumbnail box', () => {
  it('depends only on proportions, so CSS and image pixels agree', () => {
    expect(toastThumbBox(300, 200)).toEqual(toastThumbBox(600, 400))
  })
})

describe('palette', () => {
  it('finds the dominant colours, most common first, skipping near-duplicates and transparency', () => {
    const pixel = (r: number, g: number, b: number, a = 255) => [b, g, r, a]
    const pixels = new Uint8Array([
      ...Array.from({ length: 6 }, () => pixel(250, 250, 245)).flat(),
      ...Array.from({ length: 3 }, () => pixel(30, 60, 110)).flat(),
      ...pixel(252, 252, 247),
      ...pixel(200, 0, 0, 0)
    ])
    expect(extractPalette(pixels, 'bgra')).toEqual(['#FAFAF5', '#1E3C6E'])
  })
})

describe('more like this', () => {
  const snip = (id: string, pocket: string, tags: string[], createdAt = 0) => ({ id, pocket, tags, createdAt }) as Snip

  it('ranks by shared tags, then the same pocket, and offers nothing for an untagged snip', () => {
    const hero = snip('hero', 'design', ['hero', 'serif', 'landing page'])
    const all = [
      hero,
      snip('one-tag-other-pocket', 'reads', ['serif']),
      snip('one-tag-same-pocket', 'design', ['hero']),
      snip('two-tags', 'code', ['hero', 'serif']),
      snip('unrelated', 'design', ['dashboard'])
    ]
    expect(relatedSnips(hero, all).map((other) => other.id)).toEqual(['two-tags', 'one-tag-same-pocket', 'one-tag-other-pocket'])
    expect(relatedSnips(snip('bare', 'loose', []), all)).toEqual([])
  })
})

describe('search', () => {
  const snip = (patch: Partial<Snip>) => ({ title: '', note: '', summary: '', extractedText: '', prompt: '', pocket: 'loose', tags: [], ...patch }) as Snip
  const snips = [
    snip({ id: 'a', title: 'Dark finance home', tags: ['mobile', 'fintech'] }),
    snip({ id: 'b', note: 'lime accent idea', pocket: 'design' }),
    snip({ id: 'c', prompt: 'Critique my screen', extractedText: 'Hierarchy first' })
  ]

  it('matches every word anywhere in the snip, ignoring case', () => {
    expect(searchSnips(snips, 'FINANCE mobile').map((s) => s.id)).toEqual(['a'])
    expect(searchSnips(snips, 'lime design').map((s) => s.id)).toEqual(['b'])
    expect(searchSnips(snips, 'hierarchy').map((s) => s.id)).toEqual(['c'])
    expect(searchSnips(snips, '   ')).toHaveLength(3)
  })
})
