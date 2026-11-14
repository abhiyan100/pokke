import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { toastThumbBox } from '@shared/toastLayout'
import type { CaptureFrame, Rect } from '@shared/types'
import { api } from '../bridge'
import { Loupe } from './Loupe'
import { GRIPS, adjustRect, isUsable, moveRect, placeNote, rectBetween, type Grip, type Point } from './selection'

/**
 * aiming    the frozen screen is up, nothing selected yet
 * dragging  a new selection is being drawn
 * selected  a selection exists; the note field has focus
 * saving    the snip is saved and flying to the corner
 */
type Phase = 'aiming' | 'dragging' | 'selected' | 'saving'

interface Drag {
  /** 'new' draws a fresh selection; a grip adjusts the existing one. */
  grip: Grip | 'new'
  origin: Point
  last: Point
  /** The selection as it was when an adjustment began. */
  start: Rect | null
  /** Space is held: the drag moves the selection instead of resizing it. */
  moving: boolean
}

const NOTE_HEIGHT = 54
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
}

const pointOf = (event: ReactPointerEvent): Point => ({ x: event.clientX, y: event.clientY })

export function Overlay() {
  const [frame, setFrame] = useState<CaptureFrame | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [phase, setPhase] = useState<Phase>('aiming')
  const [rect, setRect] = useState<Rect | null>(null)
  const [pointer, setPointer] = useState<Point | null>(null)
  const [note, setNote] = useState('')
  const [landing, setLanding] = useState<Rect | null>(null)
  const drag = useRef<Drag | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const reducedMotion = useReducedMotion()

  // A new frozen frame arrives each time the hotkey is pressed.
  useEffect(
    () =>
      api.capture.onFrame((next) => {
        const loaded = new Image()
        loaded.src = next.imageUrl
        void loaded
          .decode()
          .catch(() => undefined)
          .then(() => {
            drag.current = null
            setFrame(next)
            setImage(loaded)
            setPhase('aiming')
            setRect(null)
            setPointer(null)
            setNote('')
            setLanding(null)
            // Two frames later the screen has painted, so the window can appear without a flash.
            requestAnimationFrame(() => requestAnimationFrame(() => api.capture.ready()))
          })
      }),
    []
  )

  useEffect(() => {
    if (phase === 'selected') input.current?.focus()
  }, [phase])

  const bounds = { width: frame?.width ?? 0, height: frame?.height ?? 0 }

  const cancel = () => {
    drag.current = null
    setPhase('aiming')
    setRect(null)
    api.capture.cancel()
  }

  const save = async () => {
    if (!frame || !isUsable(rect) || phase !== 'selected') return
    setPhase('saving')
    try {
      await api.capture.save(rect, note)
    } catch {
      setPhase('selected')
      return
    }
    if (reducedMotion) {
      api.capture.finish()
      return
    }
    const box = toastThumbBox(rect.width, rect.height)
    setLanding({ ...box, x: frame.toast.x + box.x, y: frame.toast.y + box.y })
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Enter and Escape belong to the input method while it is composing text.
      if (event.isComposing || event.keyCode === 229) return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (phase !== 'saving') cancel()
      } else if (event.key === 'Enter' && phase === 'selected') {
        event.preventDefault()
        void save()
      } else if (event.code === 'Space' && drag.current?.grip === 'new') {
        event.preventDefault()
        drag.current.moving = true
      } else if (phase === 'selected' && rect && note === '' && ARROWS[event.key]) {
        // With no note typed yet, the arrow keys nudge the selection.
        event.preventDefault()
        const [dx, dy] = ARROWS[event.key]!
        const step = event.shiftKey ? 10 : 1
        setRect(moveRect(rect, dx * step, dy * step, bounds))
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' && drag.current) drag.current.moving = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  })

  if (!frame || !image) return null

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || phase === 'saving') return
    const target = event.target as HTMLElement
    if (target.closest('[data-keep]')) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const origin = pointOf(event)
    const grip = target.closest<HTMLElement>('[data-grip]')?.dataset.grip as Grip | undefined
    if (grip && rect) {
      drag.current = { grip, origin, last: origin, start: rect, moving: false }
    } else {
      drag.current = { grip: 'new', origin, last: origin, start: null, moving: false }
      setRect(null)
      setPhase('dragging')
    }
  }

  const onPointerMove = (event: ReactPointerEvent) => {
    const now = pointOf(event)
    setPointer(now)
    const active = drag.current
    if (!active) return
    const dx = now.x - active.last.x
    const dy = now.y - active.last.y
    if (active.grip !== 'new') {
      if (active.start) {
        setRect(adjustRect(active.start, active.grip, now.x - active.origin.x, now.y - active.origin.y, bounds))
      }
    } else if (active.moving && rect) {
      active.origin = { x: active.origin.x + dx, y: active.origin.y + dy }
      setRect(moveRect(rect, dx, dy, bounds))
    } else {
      setRect(rectBetween(active.origin, now, bounds))
    }
    active.last = now
  }

  const onPointerUp = () => {
    const active = drag.current
    drag.current = null
    if (active?.grip !== 'new') return
    if (isUsable(rect)) {
      setPhase('selected')
    } else {
      setRect(null)
      setPhase('aiming')
    }
  }

  const aimed = phase === 'aiming' || phase === 'dragging'
  const hole = rect ? `M${rect.x} ${rect.y}h${rect.width}v${rect.height}h${-rect.width}Z` : ''
  const noteWidth = rect ? Math.min(Math.max(rect.width, 360), 520, bounds.width - 24) : 0
  const notePlace = rect ? placeNote(rect, bounds, { width: noteWidth, height: NOTE_HEIGHT }) : null

  return (
    <div
      className="overlay"
      data-phase={phase}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <img className="frame" src={frame.imageUrl} alt="" draggable={false} />

      <svg className="shade" aria-hidden="true">
        <path fillRule="evenodd" d={`M0 0H${bounds.width}V${bounds.height}H0Z${phase === 'saving' ? '' : hole}`} />
      </svg>

      {aimed && pointer && (
        <>
          <div className="cross cross--x" style={{ transform: `translateY(${pointer.y}px)` }} />
          <div className="cross cross--y" style={{ transform: `translateX(${pointer.x}px)` }} />
          <Loupe image={image} pointer={pointer} bounds={bounds} />
        </>
      )}

      {rect && phase !== 'saving' && (
        <div
          className="selection"
          style={{ transform: `translate(${rect.x}px, ${rect.y}px)`, width: rect.width, height: rect.height }}
        >
          <svg className="selection__stitch" aria-hidden="true">
            <rect className="selection__under" width="100%" height="100%" />
            <rect className="selection__thread" width="100%" height="100%" />
          </svg>
          {phase === 'selected' && (
            <>
              <div className="selection__body" data-grip="move" />
              {GRIPS.map((grip) => (
                <div key={grip} className="grip" data-grip={grip} />
              ))}
            </>
          )}
          <span className="size" data-inside={rect.y + rect.height + 34 > bounds.height || undefined}>
            {rect.width} × {rect.height}
          </span>
        </div>
      )}

      {phase === 'selected' && rect && notePlace && (
        <div
          className="note"
          data-keep
          data-side={notePlace.side}
          style={{ transform: `translate(${notePlace.x}px, ${notePlace.y}px)`, width: noteWidth }}
        >
          <svg className="note__thread" viewBox="0 0 24 22" aria-hidden="true">
            <path d="M12 0C12 8 5 9 7 15S12 18 12 22" />
            <circle cx="12" cy="20" r="2.6" />
          </svg>
          <input
            ref={input}
            value={note}
            placeholder="Add a note"
            aria-label="Note for this snip"
            maxLength={400}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setNote(event.target.value)}
          />
          <button className="note__save" onClick={() => void save()}>
            Save
            <kbd className="keycap">⏎</kbd>
          </button>
        </div>
      )}

      {phase === 'aiming' && (
        <p className="hint">
          Drag around what you want to keep
          <kbd className="keycap">esc</kbd>
        </p>
      )}

      {phase === 'saving' && rect && (
        <motion.div
          className="flight"
          style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
          initial={{ x: 0, y: 0, scale: 1, boxShadow: '0 0 0 0px #fbfaf5, 0 0 0 0 rgb(9 11 30 / 0)' }}
          animate={
            landing
              ? {
                  x: landing.x - rect.x,
                  y: landing.y - rect.y,
                  scale: landing.width / rect.width,
                  // The paper hem and shadow are scaled up to cancel the shrink, so they land at their real size.
                  boxShadow: `0 0 0 ${(4 * rect.width) / landing.width}px #fbfaf5, 0 ${(14 * rect.width) / landing.width}px ${(30 * rect.width) / landing.width}px rgb(9 11 30 / 0.55)`
                }
              : undefined
          }
          transition={{ type: 'spring', stiffness: 190, damping: 25, mass: 0.9 }}
          onAnimationComplete={() => landing && api.capture.finish()}
        >
          <img
            src={frame.imageUrl}
            alt=""
            draggable={false}
            style={{ left: -rect.x, top: -rect.y, width: bounds.width, height: bounds.height }}
          />
        </motion.div>
      )}
    </div>
  )
}
