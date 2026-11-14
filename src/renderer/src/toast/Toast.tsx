import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { pocketById } from '@shared/pockets'
import { toastThumbBox } from '@shared/toastLayout'
import type { Snip } from '@shared/types'
import { api } from '../bridge'
import { Pattern } from '../ui/Pattern'
import { Stitch } from '../ui/Stitch'
import { CloseIcon } from '../ui/icons'
import { fade } from '../ui/motion'

/** What the tab under the thumbnail says for each state of the snip. */
function Tab({ snip }: { snip: Snip }) {
  if (snip.status === 'analyzing') {
    return (
      <>
        <span className="toast__knot" aria-hidden="true" />
        <span>Filing…</span>
      </>
    )
  }
  if (snip.status === 'failed') return <span className="toast__plain">Saved, not filed</span>
  if (snip.status === 'waiting') return <span className="toast__plain">Saved</span>

  const pocket = pocketById(snip.pocket)
  return (
    <>
      <span className="toast__swatch cloth" aria-hidden="true">
        <Pattern pattern={pocket.pattern} ground="var(--kon-lift)" opacity={0.85} scale={0.45} />
      </span>
      <span>{pocket.name}</span>
      {snip.title && <span className="toast__title">{snip.title}</span>}
    </>
  )
}

function Card({ snip }: { snip: Snip }) {
  const box = toastThumbBox(snip.width, snip.height)
  return (
    <motion.div className="toast" exit={{ opacity: 0, x: 28 }} transition={{ duration: 0.2, ease: 'easeIn' }}>
      <button
        className="toast__paper"
        style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
        onClick={() => api.toast.open(snip.id)}
        aria-label="Open this snip in the library"
      >
        <img src={snip.thumbUrl} alt="" draggable={false} />
        {snip.status === 'analyzing' && <Stitch inset={-8} radius={9} tone="accent" marching />}
      </button>

      <div className="toast__tab cloth" role="status">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={snip.status}
            className="toast__tab-content"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={fade}
          >
            <Tab snip={snip} />
          </motion.span>
        </AnimatePresence>
      </div>

      <button
        className="toast__close"
        style={{ left: box.x - 14, top: box.y - 14 }}
        onClick={() => api.toast.dismiss()}
        aria-label="Dismiss"
      >
        <CloseIcon />
      </button>
    </motion.div>
  )
}

/** The corner thumbnail: the snip that was just saved, and what became of it. */
export function Toast() {
  const [snip, setSnip] = useState<Snip | null>(null)
  useEffect(() => api.toast.onSnip(setSnip), [])

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>{snip && <Card key={snip.id} snip={snip} />}</AnimatePresence>
    </MotionConfig>
  )
}
