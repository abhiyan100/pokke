import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Pattern } from '@app/ui/Pattern'
import { CheckIcon, CloseIcon, CopyIcon } from '@app/ui/icons'
import { fade, sheet } from '@app/ui/motion'
import { pocketById } from '@shared/pockets'
import heroPhoto from './assets/hero-roll.jpg'
import { HERO_POCKETS, PHOTO, type HeroCard, type HeroPocket } from './hero'

const percent = (value: number, of: number) => `${(value / of) * 100}%`

/**
 * Where a card sits in its pocket: tucked at rest, fanned when the pocket is
 * hovered. The last entry is the card on top. A card turns about the point
 * where the pocket's edge holds it, so a fan spreads at the top like a hand of
 * cards while every foot stays in the pocket. Offsets are percentages of the
 * card's own size, so they hold at any scale of the photograph.
 */
const FAN = [
  { rest: { rotate: -6, x: -8, y: 5 }, fanned: { rotate: -13, x: -17, y: -15 } },
  { rest: { rotate: 5, x: 7, y: 7 }, fanned: { rotate: 12, x: 17, y: -12 } },
  { rest: { rotate: 0, x: 0, y: 0 }, fanned: { rotate: -1, x: 0, y: -9 } }
]

/** Cards keep this far inside a pocket's side seams, in photograph pixels: clear of the thread itself. */
const SEAM = 8

/**
 * How far a card can slide each way before its foot would show on the cloth
 * beside the pocket, as a percentage of the card's width.
 */
function room(pocket: HeroPocket) {
  const { x, width } = pocket.slot
  return {
    left: (Math.max(0, x - pocket.left - SEAM) / width) * 100,
    right: (Math.max(0, pocket.right - (x + width) - SEAM) / width) * 100
  }
}

/** Tucked in the pocket, fanned with its pocket, reached for by the pointer, or pulled clear to be opened. */
type Hold = 'rest' | 'fanned' | 'reached' | 'pulled'

function pose(fan: (typeof FAN)[number], hold: Hold, space: ReturnType<typeof room>) {
  const { rotate, x: slide, y } = hold === 'rest' ? fan.rest : fan.fanned
  const x = Math.min(Math.max(slide, -space.left), space.right)
  if (hold === 'reached') return { rotate: rotate * 0.4, x: `${x}%`, y: `${y - 14}%`, scale: 1.03 }
  // Far enough up that the whole card is clear of the pocket's edge.
  if (hold === 'pulled') return { rotate: 0, x: `${x}%`, y: '-64%', scale: 1.04 }
  return { rotate, x: `${x}%`, y: `${y}%`, scale: 1 }
}

// Paper leaving cloth: a soft spring with some weight, so a card overshoots a touch and settles.
const RISE: Transition = { type: 'spring', stiffness: 190, damping: 17, mass: 0.85 }
// Dropping back in is quicker and does not bounce.
const DROP: Transition = { type: 'spring', stiffness: 340, damping: 34 }
// The card that was pulled out growing into the full view, and shrinking back.
const TRAVEL: Transition = { type: 'spring', visualDuration: 0.42, bounce: 0.14 }

const PULL_MS = 240
/** After the headline has sewn itself in, the first pocket shows its cards once. */
const GREET_AT_MS = 2300
const GREET_FOR_MS = 1100

interface PocketProps {
  pocket: HeroPocket
  /** The card lifted clear of its pocket, if any. */
  pulled: HeroCard | null
  /** Show the cards briefly on load, as a hint that they can be taken out. */
  greet: boolean
  onPull(card: HeroCard): void
}

function Pocket({ pocket, pulled, greet, onPull }: PocketProps) {
  const [fanned, setFanned] = useState(false)
  const [reached, setReached] = useState<string | null>(null)
  const touched = useRef(false)
  const width = pocket.right - pocket.left
  const space = room(pocket)
  // The pocket's edge, measured down from the top of a card (the roll is the container, so cqw scales with the photograph).
  const edge = `${((PHOTO.lip - pocket.slot.top) / PHOTO.width) * 100}cqw`
  const busy = pulled !== null

  useEffect(() => {
    if (!greet) return
    const show = setTimeout(() => !touched.current && setFanned(true), GREET_AT_MS)
    const hide = setTimeout(() => !touched.current && setFanned(false), GREET_AT_MS + GREET_FOR_MS)
    return () => {
      clearTimeout(show)
      clearTimeout(hide)
    }
  }, [greet])

  const fan = (open: boolean) => {
    touched.current = true
    setFanned(open)
    if (!open) setReached(null)
  }

  return (
    <div
      className="hero-pocket"
      data-lifted={fanned || pocket.cards.some((card) => card.id === pulled?.id) || undefined}
      // The strip above this pocket's top edge: cards are cut off at its bottom, as if tucked in.
      style={{ left: percent(pocket.left, PHOTO.width), width: percent(width, PHOTO.width), height: percent(PHOTO.lip, PHOTO.height) }}
      onPointerEnter={() => !busy && fan(true)}
      onPointerLeave={() => !busy && fan(false)}
      // Keyboard focus fans the pocket open; focus that merely returns after a click does not.
      onFocus={(event) => !busy && event.target.matches(':focus-visible') && fan(true)}
      onBlur={() => !busy && fan(false)}
    >
      {pocket.cards.map((card, index) => {
        const place = FAN[FAN.length - pocket.cards.length + index]!
        const hold: Hold = pulled?.id === card.id ? 'pulled' : !fanned ? 'rest' : reached === card.id ? 'reached' : 'fanned'
        // The front card leads on the way out; on the way back the cards behind go first.
        const order = hold === 'rest' ? index : pocket.cards.length - 1 - index
        return (
          <motion.button
            key={card.id}
            className="hero-card"
            style={{
              left: percent(pocket.slot.x - pocket.left, width),
              width: percent(pocket.slot.width, width),
              top: percent(pocket.slot.top, PHOTO.lip),
              transformOrigin: `50% ${edge}`,
              zIndex: hold === 'pulled' ? 3 : hold === 'reached' ? 2 : undefined
            }}
            initial={false}
            animate={pose(place, hold, space)}
            transition={{ ...(hold === 'rest' ? DROP : RISE), delay: hold === 'reached' || hold === 'pulled' ? 0 : order * 0.045 }}
            onPointerEnter={() => !busy && setReached(card.id)}
            onPointerLeave={() => !busy && setReached(null)}
            onFocus={(event) => !busy && event.target.matches(':focus-visible') && setReached(card.id)}
            onClick={() => !busy && onPull(card)}
            aria-label={`Open ${card.title}, in ${pocket.name}`}
          >
            <motion.span className="hero-card__paper" layoutId={`hero-${card.id}`} transition={TRAVEL}>
              <img src={card.image} alt="" draggable={false} />
            </motion.span>
          </motion.button>
        )
      })}
    </div>
  )
}

function Detail({ card, onClose }: { card: HeroCard; onClose(): void }) {
  const close = useRef<HTMLButtonElement>(null)
  const [copied, setCopied] = useState(false)
  const pocket = pocketById(card.pocket)

  // A layout effect, so the view takes focus and answers Escape from the moment it is on the page.
  // A plain effect runs a task later when the view opens from the pull timer, and a key pressed in
  // that gap would be lost.
  useLayoutEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    close.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      opener?.focus()
    }
  }, [onClose])

  return (
    <motion.div
      className="detail"
      role="dialog"
      aria-modal="true"
      aria-label={card.title}
      initial={{ backgroundColor: 'rgba(16, 18, 41, 0)' }}
      animate={{ backgroundColor: 'rgba(16, 18, 41, 0.9)' }}
      exit={{ backgroundColor: 'rgba(16, 18, 41, 0)' }}
      transition={fade}
      onClick={onClose}
    >
      {/* The same piece of paper that was in the pocket, grown to full size. */}
      <motion.div className="detail__image" layoutId={`hero-${card.id}`} transition={TRAVEL} onClick={(event) => event.stopPropagation()}>
        <img src={card.image} alt={card.summary} />
      </motion.div>

      <motion.aside
        className="detail__slip"
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 32, opacity: 0 }}
        transition={sheet}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="detail__top">
          <span className="detail__pocket">
            <span className="detail__swatch cloth" aria-hidden="true">
              <Pattern pattern={pocket.pattern} ground="var(--kon-lift)" opacity={0.85} scale={0.5} />
            </span>
            {pocket.name}
          </span>
          <button className="detail__close" ref={close} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        <h2>{card.title}</h2>
        <p className="detail__summary">{card.summary}</p>
        <h3>Prompt</h3>
        <p className="detail__prompt">{card.prompt}</p>
        <button
          className="button button--primary"
          onClick={() => {
            void navigator.clipboard?.writeText(card.prompt).catch(() => undefined)
            setCopied(true)
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Prompt copied' : 'Copy prompt'}
        </button>
      </motion.aside>
    </motion.div>
  )
}

/**
 * The hero photograph with live cards in its pockets: snips of posts that
 * slide up when hovered and, when clicked, are pulled out and opened with the
 * prompt the app wrote for them.
 */
export function HeroRoll() {
  const [pulled, setPulled] = useState<HeroCard | null>(null)
  const [open, setOpen] = useState<HeroCard | null>(null)
  const reducedMotion = useReducedMotion()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  // First the card comes all the way out of the pocket, then it grows into the full view.
  const pull = (card: HeroCard) => {
    setPulled(card)
    clearTimeout(timer.current)
    if (reducedMotion) setOpen(card)
    else timer.current = setTimeout(() => setOpen(card), PULL_MS)
  }

  return (
    <>
      <div className="hero__roll">
        <img className="hero__photo" src={heroPhoto} alt="An indigo cloth roll with stitched pockets holding saved snips" />
        {HERO_POCKETS.map((pocket, index) => (
          <Pocket key={pocket.name} pocket={pocket} pulled={pulled} greet={index === 0} onPull={pull} />
        ))}
      </div>
      {/* When the full view has gone, the card drops back into its pocket. */}
      <AnimatePresence onExitComplete={() => setPulled(null)}>
        {open && <Detail key={open.id} card={open} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </>
  )
}
