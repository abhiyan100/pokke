import type { Rect } from './types'

/**
 * Geometry of the corner thumbnail window. The capture overlay flies the
 * saved snip to exactly where the thumbnail will appear, so both pages and
 * the main process must agree on these numbers.
 */
export const TOAST = {
  width: 296,
  height: 236,
  /** Gap between the window edge and its content, leaving room for shadows. */
  pad: 18,
  /** Height of the status tab under the thumbnail, and the gap above it. */
  tab: 34,
  gap: 10,
  thumbMaxWidth: 248,
  thumbMaxHeight: 148
} as const

/**
 * Where the snip's image sits inside the toast window: scaled to fit the
 * thumbnail area and anchored to its bottom-right corner. Only the snip's
 * proportions matter, so CSS pixels and image pixels give the same box.
 */
export function toastThumbBox(snipWidth: number, snipHeight: number): Rect {
  const scale = Math.min(TOAST.thumbMaxWidth / snipWidth, TOAST.thumbMaxHeight / snipHeight)
  const width = Math.max(Math.round(snipWidth * scale), 48)
  const height = Math.max(Math.round(snipHeight * scale), 36)
  return {
    width,
    height,
    x: TOAST.width - TOAST.pad - width,
    y: TOAST.height - TOAST.pad - TOAST.tab - TOAST.gap - height
  }
}
