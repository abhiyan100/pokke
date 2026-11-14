import { motion } from 'motion/react'
import { useMemo, useState, type ReactNode } from 'react'
import type { Pocket } from '@shared/pockets'
import type { CopyKind, Snip } from '@shared/types'
import { api } from '../bridge'
import { Pattern } from '../ui/Pattern'
import { Stitch } from '../ui/Stitch'
import { BackIcon, CheckIcon, CopyIcon, ImageIcon } from '../ui/icons'
import { fade, travel } from '../ui/motion'
import { commonTags, snipLabel } from './snips'

interface GridProps {
  /** The pocket being shown, or null for search results. */
  pocket: Pocket | null
  heading: string
  snips: Snip[]
  onBack(): void
  onOpenSnip(id: string): void
  /** Shown when the list is empty. */
  empty: ReactNode
}

function QuickCopy({ snip, kind }: { snip: Snip; kind: CopyKind }) {
  const [copied, setCopied] = useState(false)
  const label = kind === 'prompt' ? 'Copy prompt' : 'Copy image'
  return (
    <button
      className="quick"
      aria-label={copied ? 'Copied' : label}
      title={label}
      disabled={kind === 'prompt' && !snip.prompt}
      onClick={(event) => {
        event.stopPropagation()
        api.snips
          .copy(snip.id, kind)
          .then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1400)
          })
          .catch(() => undefined)
      }}
    >
      {copied ? <CheckIcon /> : kind === 'prompt' ? <CopyIcon /> : <ImageIcon />}
    </button>
  )
}

function statusNote(snip: Snip): string | null {
  if (snip.status === 'analyzing') return 'Filing…'
  if (snip.status === 'waiting') return 'Not filed yet'
  if (snip.status === 'failed') return 'Could not be filed'
  return null
}

function Card({ snip, onOpen }: { snip: Snip; onOpen(): void }) {
  const note = statusNote(snip)
  // Very tall snips are cropped from the top in the grid and shown whole when opened.
  const ratio = `${snip.width} / ${Math.min(snip.height, snip.width * 1.45)}`

  return (
    <article className="card" data-status={snip.status}>
      <button className="card__open" onClick={onOpen} aria-label={`Open ${snipLabel(snip)}`}>
        <motion.span className="paper" layoutId={`snip-${snip.id}`} transition={travel}>
          <img src={snip.thumbUrl} alt="" loading="lazy" draggable={false} style={{ aspectRatio: ratio }} />
        </motion.span>
        {snip.status === 'analyzing' && <Stitch inset={-6} radius={10} tone="accent" marching />}
      </button>
      <div className="card__foot">
        <div className="card__text">
          <h3 className="card__title">{snipLabel(snip)}</h3>
          {note && <p className="card__status">{note}</p>}
        </div>
        <div className="card__quick">
          <QuickCopy snip={snip} kind="prompt" />
          <QuickCopy snip={snip} kind="image" />
        </div>
      </div>
    </article>
  )
}

export function Grid({ pocket, heading, snips, onBack, onOpenSnip, empty }: GridProps) {
  const [tag, setTag] = useState<string | null>(null)
  const tags = useMemo(() => commonTags(snips), [snips])
  const activeTag = tag && tags.includes(tag) ? tag : null
  const shown = activeTag ? snips.filter((snip) => snip.tags.includes(activeTag)) : snips

  return (
    <motion.main className="grid-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>
      <header className="grid-head">
        <button className="icon-button" onClick={onBack} aria-label="Back to all pockets">
          <BackIcon />
        </button>
        {pocket && (
          <span className="grid-head__swatch cloth" aria-hidden="true">
            <Pattern pattern={pocket.pattern} ground="var(--kon-lift)" opacity={0.85} scale={0.45} />
          </span>
        )}
        <h1 className="grid-head__title">{heading}</h1>
        <span className="grid-head__count">{snips.length}</span>

        {tags.length > 1 && (
          <div className="tags" role="group" aria-label="Filter by tag">
            {tags.map((name) => (
              <button
                key={name}
                className="tag"
                aria-pressed={name === activeTag}
                onClick={() => setTag(name === activeTag ? null : name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </header>

      {shown.length === 0 ? (
        <div className="grid-empty">{empty}</div>
      ) : (
        <div className="masonry">
          {shown.map((snip) => (
            <Card key={snip.id} snip={snip} onOpen={() => onOpenSnip(snip.id)} />
          ))}
        </div>
      )}
    </motion.main>
  )
}
