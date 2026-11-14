import type { Rect } from '@shared/types'

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

/** Which part of a selection is being dragged: an edge, a corner, or the whole thing. */
export type Grip = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'move'

export const GRIPS: Exclude<Grip, 'move'>[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

/** Anything smaller than this in either direction is treated as a stray click. */
export const MIN_SIZE = 8

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/** The rectangle spanned by two points, in whichever order they were dragged. */
export function rectBetween(a: Point, b: Point, bounds: Size): Rect {
  const x1 = clamp(Math.min(a.x, b.x), 0, bounds.width)
  const y1 = clamp(Math.min(a.y, b.y), 0, bounds.height)
  const x2 = clamp(Math.max(a.x, b.x), 0, bounds.width)
  const y2 = clamp(Math.max(a.y, b.y), 0, bounds.height)
  return { x: Math.round(x1), y: Math.round(y1), width: Math.round(x2 - x1), height: Math.round(y2 - y1) }
}

export function isUsable(rect: Rect | null): rect is Rect {
  return rect !== null && rect.width >= MIN_SIZE && rect.height >= MIN_SIZE
}

/** Moves a selection without letting any of it leave the screen. */
export function moveRect(rect: Rect, dx: number, dy: number, bounds: Size): Rect {
  return {
    ...rect,
    x: clamp(Math.round(rect.x + dx), 0, Math.max(bounds.width - rect.width, 0)),
    y: clamp(Math.round(rect.y + dy), 0, Math.max(bounds.height - rect.height, 0))
  }
}

/**
 * Drags one edge or corner of a selection. Dragging an edge past the
 * opposite one flips the selection rather than collapsing it.
 */
export function adjustRect(rect: Rect, grip: Grip, dx: number, dy: number, bounds: Size): Rect {
  if (grip === 'move') return moveRect(rect, dx, dy, bounds)
  let left = rect.x
  let top = rect.y
  let right = rect.x + rect.width
  let bottom = rect.y + rect.height
  if (grip.includes('w')) left += dx
  if (grip.includes('e')) right += dx
  if (grip.includes('n')) top += dy
  if (grip.includes('s')) bottom += dy
  return rectBetween({ x: left, y: top }, { x: right, y: bottom }, bounds)
}

/**
 * Where the note bar goes: under the selection when there is room, otherwise
 * above it, otherwise inside along its bottom edge.
 */
export function placeNote(rect: Rect, bounds: Size, bar: Size, gap = 14): Point & { side: 'below' | 'above' | 'inside' } {
  const x = clamp(rect.x + rect.width / 2 - bar.width / 2, 12, Math.max(bounds.width - bar.width - 12, 12))
  const below = rect.y + rect.height + gap
  if (below + bar.height <= bounds.height - 12) return { x, y: below, side: 'below' }
  const above = rect.y - gap - bar.height
  if (above >= 12) return { x, y: above, side: 'above' }
  return { x, y: rect.y + rect.height - bar.height - gap, side: 'inside' }
}

/** Where the magnifier sits relative to the pointer, flipping away from the screen edges. */
export function placeLoupe(pointer: Point, bounds: Size, size: number, offset = 26): Point {
  const fitsRight = pointer.x + offset + size <= bounds.width - 8
  const fitsBelow = pointer.y + offset + size + 30 <= bounds.height - 8
  return {
    x: fitsRight ? pointer.x + offset : pointer.x - offset - size,
    y: fitsBelow ? pointer.y + offset : pointer.y - offset - size - 30
  }
}
