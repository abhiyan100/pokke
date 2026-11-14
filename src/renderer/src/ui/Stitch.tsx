import type { CSSProperties } from 'react'

interface StitchProps {
  /** Distance from the edge of the parent, in px. */
  inset?: number
  /** Corner radius, in px. */
  radius?: number
  /** thread: undyed cotton. soft: the same, fainter. accent: the red thread. ink: indigo, for paper. */
  tone?: 'thread' | 'soft' | 'accent' | 'ink'
  /** Animate the stitches travelling, to show work in progress. */
  marching?: boolean
}

/**
 * A running stitch around the inside of its parent, which must be positioned.
 * Drawn as SVG so the dashes have round ends and a controllable length, which
 * a CSS dashed border cannot do.
 */
export function Stitch({ inset = 6, radius = 8, tone = 'thread', marching = false }: StitchProps) {
  const rect = {
    x: inset,
    y: inset,
    width: `calc(100% - ${inset * 2}px)`,
    height: `calc(100% - ${inset * 2}px)`,
    rx: radius
  } as CSSProperties

  return (
    <svg
      className={`stitch stitch--${tone}${marching ? ' stitch--marching' : ''}`}
      aria-hidden="true"
      focusable="false"
    >
      <rect style={rect} />
    </svg>
  )
}
