import { motion } from 'motion/react'
import { POCKETS, type Pocket, type PocketId } from '@shared/pockets'
import type { Snip } from '@shared/types'
import { Pattern } from '../ui/Pattern'
import { Stitch } from '../ui/Stitch'
import { settle, travel } from '../ui/motion'
import { snipLabel } from './snips'

interface RollProps {
  snips: Snip[]
  /** The double-tap key as written on the keyboard, or null when the double-tap is off. */
  doubleTap: string | null
  onOpenPocket(id: PocketId): void
  onOpenSnip(id: string): void
}

/** How the three peeking cards sit at rest and when the pocket is hovered. */
const FAN = [
  { rest: { rotate: -5, x: -16, y: 10 }, lift: { rotate: -9, x: -26, y: -8 } },
  { rest: { rotate: 3, x: 15, y: 16 }, lift: { rotate: 8, x: 27, y: -4 } },
  { rest: { rotate: -1, x: 0, y: 0 }, lift: { rotate: 0, x: 0, y: -22 } }
] as const

/** Peeking cards are cropped to a near-square so every pocket shows a similar amount of card. */
function peekRatio(snip: Snip): string {
  const height = Math.min(Math.max(snip.height, snip.width * 0.92), snip.width * 1.3)
  return `${snip.width} / ${height}`
}

function PocketSlot({ pocket, snips, onOpen }: { pocket: Pocket; snips: Snip[]; onOpen(): void }) {
  // Newest on top: the last element drawn is the front card.
  const peeking = snips.slice(0, 3).reverse()
  const count = snips.length

  return (
    <motion.button
      className="pocket"
      data-pocket={pocket.id}
      data-empty={count === 0 || undefined}
      initial="rest"
      animate="rest"
      whileHover="lift"
      whileFocus="lift"
      onClick={onOpen}
      aria-label={`${pocket.name}, ${count} ${count === 1 ? 'snip' : 'snips'}`}
    >
      <span className="pocket__cards" aria-hidden="true">
        {peeking.map((snip, index) => {
          const fan = FAN[FAN.length - peeking.length + index]!
          return (
            <motion.span
              key={snip.id}
              className="pocket__card"
              variants={{ rest: fan.rest, lift: fan.lift }}
              transition={settle}
            >
              <motion.span className="paper" layoutId={`snip-${snip.id}`} transition={travel}>
                <img
                  src={snip.thumbUrl}
                  alt=""
                  draggable={false}
                  style={{ aspectRatio: peekRatio(snip) }}
                />
              </motion.span>
            </motion.span>
          )
        })}
      </span>

      <span className="pocket__front cloth">
        <span className="pocket__pattern">
          <Pattern pattern={pocket.pattern} ground="var(--kon-shade)" opacity={count === 0 ? 0.24 : 0.5} />
        </span>
        <Stitch inset={7} radius={9} tone="soft" />
        <span className="pocket__label">
          <span className="pocket__name">{pocket.name}</span>
          <span className="pocket__count">{count}</span>
        </span>
      </span>
    </motion.button>
  )
}

export function Roll({ snips, doubleTap, onOpenPocket, onOpenSnip }: RollProps) {
  const latest = snips.slice(0, 7)

  return (
    <main className="roll-view">
      <section className="roll cloth" aria-label="Pockets">
        <Stitch inset={11} radius={18} tone="soft" />
        <div className="roll__pockets">
          {POCKETS.map((pocket) => (
            <PocketSlot
              key={pocket.id}
              pocket={pocket}
              snips={snips.filter((snip) => snip.pocket === pocket.id)}
              onOpen={() => onOpenPocket(pocket.id)}
            />
          ))}
        </div>
      </section>

      {latest.length > 0 ? (
        <section className="latest" aria-label="Latest snips">
          <h2 className="latest__title">Latest</h2>
          <div className="latest__row">
            {latest.map((snip) => (
              <button
                key={snip.id}
                className="latest__item"
                onClick={() => onOpenSnip(snip.id)}
                aria-label={snipLabel(snip)}
                title={snipLabel(snip)}
              >
                <span className="paper">
                  <img src={snip.thumbUrl} alt="" draggable={false} />
                </span>
                {snip.status === 'analyzing' && <Stitch inset={-5} radius={9} tone="accent" marching />}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="empty-hint" aria-label="How to snip">
          <p>
            {doubleTap ? (
              <>
                <kbd className="keycap">{doubleTap}</kbd>
                <kbd className="keycap">{doubleTap}</kbd>
                <span>Double-tap to snip anything on screen</span>
              </>
            ) : (
              <span>Press Snip to capture anything on screen</span>
            )}
          </p>
        </section>
      )}
    </main>
  )
}
