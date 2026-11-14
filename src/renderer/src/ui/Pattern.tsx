import { useId, type ReactNode } from 'react'
import type { PatternId } from '@shared/pockets'

interface Tile {
  width: number
  height: number
  /** Stitched lines of one repeat. `ground` is the cloth colour, for shapes that must hide what is behind them. */
  draw(ground: string): ReactNode
}

const SQRT3 = Math.sqrt(3)

/** Asanoha (hemp leaf): a triangle grid with each triangle joined centre to corners. */
function asanoha(): Tile {
  const s = 34
  const h = s * SQRT3
  const lines = [
    `M0 0H${s}`,
    `M0 ${h / 2}H${s}`,
    `M0 0L${s} ${h}`,
    `M${s} 0L0 ${h}`,
    // Upward triangle at the top, downward at the bottom.
    `M${s / 2} ${h / 6}L0 0M${s / 2} ${h / 6}L${s} 0M${s / 2} ${h / 6}V${h / 2}`,
    `M${s / 2} ${(5 * h) / 6}V${h / 2}M${s / 2} ${(5 * h) / 6}L0 ${h}M${s / 2} ${(5 * h) / 6}L${s} ${h}`,
    // The triangles that straddle the left and right edges.
    `M0 0V${h / 3}L${s / 2} ${h / 2}L0 ${(2 * h) / 3}V${h}`,
    `M${s} ${h / 3}L${s / 2} ${h / 2}L${s} ${(2 * h) / 3}`
  ]
  return { width: s, height: h, draw: () => <path d={lines.join('')} /> }
}

/** Yabane (arrow feathers): columns of opposing diagonals. */
function yabane(): Tile {
  const w = 17
  const p = 17
  return {
    width: w * 2,
    height: p,
    draw: () => (
      <path
        d={`M0 0V${p}M${w} 0V${p}M0 ${p / 2}L${w} 0M0 ${p}L${w} ${p / 2}M${w} 0L${w * 2} ${p / 2}M${w} ${p / 2}L${w * 2} ${p}`}
      />
    )
  }
}

/** Seigaiha (waves): rows of concentric arcs, each row overlapping the one behind. */
function seigaiha(): Tile {
  const r = 22
  const rows: [number, number][] = [
    [r, -r / 2],
    [0, 0],
    [2 * r, 0],
    [r, r / 2],
    [0, r],
    [2 * r, r],
    [r, (3 * r) / 2]
  ]
  return {
    width: 2 * r,
    height: r,
    draw: (ground) =>
      rows.map(([cx, cy]) => (
        <g key={`${cx},${cy}`}>
          <circle cx={cx} cy={cy} r={r} fill={ground} />
          <circle cx={cx} cy={cy} r={r * 0.68} fill="none" />
          <circle cx={cx} cy={cy} r={r * 0.36} fill="none" />
        </g>
      ))
  }
}

/** Igeta (well curb): the # shape. */
function igeta(): Tile {
  const size = 30
  return {
    width: size,
    height: size,
    draw: () => <path d={`M10 4V26M20 4V26M4 10H26M4 20H26`} />
  }
}

/** Shima (stripes): set like lines of text, the last one short. */
function shima(): Tile {
  return {
    width: 64,
    height: 30,
    draw: () => <path d="M3 5H61M3 15H61M3 25H38" />
  }
}

/** Shippo (seven treasures): overlapping circles that form four-petal flowers. */
function shippo(): Tile {
  const g = 30
  const r = g / Math.SQRT2
  return {
    width: g,
    height: g,
    draw: () =>
      [
        [0, 0],
        [g, 0],
        [0, g],
        [g, g]
      ].map(([cx, cy]) => <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} fill="none" />)
  }
}

/** Juji (crosses): small plus signs, staggered. */
function juji(): Tile {
  return {
    width: 22,
    height: 22,
    draw: () => <path d="M5.5 2.5V8.5M2.5 5.5H8.5M16.5 13.5V19.5M13.5 16.5H19.5" />
  }
}

const TILES: Record<PatternId, Tile> = {
  asanoha: asanoha(),
  yabane: yabane(),
  seigaiha: seigaiha(),
  igeta: igeta(),
  shima: shima(),
  shippo: shippo(),
  juji: juji()
}

interface PatternProps {
  pattern: PatternId
  /** Cloth colour behind the stitches; only seigaiha needs it. */
  ground?: string
  opacity?: number
  scale?: number
}

/** Fills its (positioned) parent with one sashiko pattern, stitched in thread. */
export function Pattern({ pattern, ground = 'var(--kon)', opacity = 0.5, scale = 1 }: PatternProps) {
  const id = useId()
  const tile = TILES[pattern]
  return (
    <svg className="pattern" aria-hidden="true" focusable="false" style={{ opacity }}>
      <defs>
        <pattern
          id={id}
          width={tile.width}
          height={tile.height}
          patternUnits="userSpaceOnUse"
          patternTransform={`scale(${scale})`}
        >
          <g fill="none" stroke="var(--thread)" strokeWidth={1.25} strokeDasharray="4.2 3.2" strokeLinecap="round">
            {tile.draw(ground)}
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}
