import { motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { isUsable, rectBetween, type Point, type Size } from '@app/overlay/selection'
import { Pattern } from '@app/ui/Pattern'
import { Stitch } from '@app/ui/Stitch'
import { CheckIcon, CopyIcon, RetryIcon } from '@app/ui/icons'
import { travel } from '@app/ui/motion'
import { POCKETS, pocketById } from '@shared/pockets'
import type { Rect } from '@shared/types'
import screenUrl from '@samples/screen.svg'
import { AUTO_SELECTION, SCREEN, fileSelection, type DemoResult } from './content'

/**
 * idle      waiting for a drag (or for the page to scroll here and play itself)
 * dragging  a selection is being drawn
 * filing    the "model" is looking at the snip
 * filed     the snip sits in its pocket and its prompt is shown
 */
type Phase = 'idle' | 'dragging' | 'filing' | 'filed'

const FILING_MS = 950
const AUTO_DRAG_MS = 1200

/** The cut-out region of the sample desktop, drawn at any width. */
function Cutout({ selection, stage, width }: { selection: Rect; stage: Size; width: number }) {
  const scale = width / selection.width
  return (
    <span className="cutout" style={{ width, height: selection.height * scale }}>
      <img
        src={screenUrl}
        alt=""
        draggable={false}
        style={{ width: stage.width * scale, left: -selection.x * scale, top: -selection.y * scale }}
      />
    </span>
  )
}

export function Demo() {
  const stage = useRef<HTMLDivElement>(null)
  const origin = useRef<Point | null>(null)
  const touched = useRef(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [rect, setRect] = useState<Rect | null>(null)
  const [bounds, setBounds] = useState<Size>({ width: 0, height: 0 })
  const [result, setResult] = useState<DemoResult | null>(null)
  const [copied, setCopied] = useState(false)
  const reducedMotion = useReducedMotion()

  const measure = (): Size => {
    const box = stage.current!.getBoundingClientRect()
    const size = { width: box.width, height: box.height }
    setBounds(size)
    return size
  }

  const file = useCallback(
    (selection: Rect, size: Size) => {
      const scale = SCREEN.width / size.width
      const filed = fileSelection({
        x: selection.x * scale,
        y: selection.y * scale,
        width: selection.width * scale,
        height: selection.height * scale
      })
      setRect(selection)
      setResult(filed)
      setCopied(false)
      setPhase('filing')
      window.setTimeout(() => setPhase('filed'), reducedMotion ? 0 : FILING_MS)
    },
    [reducedMotion]
  )

  // Plays itself once when it scrolls into view, unless the visitor got there first.
  useEffect(() => {
    const element = stage.current
    if (!element) return
    let frame = 0
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || touched.current) return
        observer.disconnect()
        touched.current = true
        const size = measure()
        const scale = size.width / SCREEN.width
        const target: Rect = {
          x: AUTO_SELECTION.x * scale,
          y: AUTO_SELECTION.y * scale,
          width: AUTO_SELECTION.width * scale,
          height: AUTO_SELECTION.height * scale
        }
        if (reducedMotion) {
          file(target, size)
          return
        }
        setPhase('dragging')
        const start = performance.now()
        const step = (now: number) => {
          const progress = Math.min((now - start) / AUTO_DRAG_MS, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          setRect({ ...target, width: target.width * eased, height: target.height * eased })
          if (progress < 1) frame = requestAnimationFrame(step)
          else file(target, size)
        }
        frame = requestAnimationFrame(step)
      },
      { threshold: 0.6 }
    )
    observer.observe(element)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [file, reducedMotion])

  const pointIn = (event: ReactPointerEvent): Point => {
    const box = stage.current!.getBoundingClientRect()
    return { x: event.clientX - box.left, y: event.clientY - box.top }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Dragging is for mice and trackpads; on touch the stage must not block scrolling.
    if (event.pointerType !== 'mouse' || event.button !== 0 || phase === 'filing') return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    touched.current = true
    measure()
    origin.current = pointIn(event)
    setRect(null)
    setResult(null)
    setPhase('dragging')
  }

  const onPointerMove = (event: ReactPointerEvent) => {
    if (origin.current) setRect(rectBetween(origin.current, pointIn(event), bounds))
  }

  const onPointerUp = () => {
    if (!origin.current) return
    origin.current = null
    if (isUsable(rect) && rect.width > 24 && rect.height > 24) {
      file(rect, bounds)
    } else {
      setRect(null)
      setPhase('idle')
    }
  }

  const replay = () => {
    touched.current = true
    setRect(null)
    setResult(null)
    setPhase('idle')
  }

  const hole = rect && phase !== 'filed' ? `M${rect.x} ${rect.y}h${rect.width}v${rect.height}h${-rect.width}Z` : ''
  const filedPocket = result && phase === 'filed' ? result.pocket : null

  return (
    <div className="demo">
      <div className="demo__left">
      <div
        className="demo__stage"
        ref={stage}
        data-phase={phase}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img className="demo__screen" src={screenUrl} alt="A sample desktop showing a social feed with a design post and a prompt post" draggable={false} />
        <svg className="demo__shade" aria-hidden="true">
          <path fillRule="evenodd" d={`M0 0H${bounds.width || 4000}V${bounds.height || 4000}H0Z${hole}`} />
        </svg>

        {rect && phase !== 'filed' && (
          <div className="demo__selection" style={{ transform: `translate(${rect.x}px, ${rect.y}px)`, width: rect.width, height: rect.height }}>
            {phase === 'filing' ? (
              <motion.span className="demo__paper" layoutId="demo-paper" transition={travel}>
                <Cutout selection={rect} stage={bounds} width={rect.width} />
                <Stitch inset={-7} radius={8} tone="accent" marching />
              </motion.span>
            ) : (
              <Stitch inset={0} radius={0} />
            )}
          </div>
        )}

        {phase === 'idle' && <p className="demo__hint">Drag around the design, or the prompt below it</p>}
        {phase === 'filing' && <p className="demo__hint demo__hint--working">Filing…</p>}
      </div>

        <div className="shelf cloth" aria-label="Pockets">
          <Stitch inset={8} radius={14} tone="soft" />
          {POCKETS.map((pocket) => (
            <div className="shelf__pocket" key={pocket.id} data-filled={pocket.id === filedPocket || undefined}>
              <span className="shelf__card">
                {pocket.id === filedPocket && rect && (
                  <motion.span className="demo__paper" layoutId="demo-paper" transition={travel}>
                    <Cutout selection={rect} stage={bounds} width={Math.min(64, (58 * rect.width) / rect.height)} />
                  </motion.span>
                )}
              </span>
              <span className="shelf__front cloth">
                <Pattern pattern={pocket.pattern} ground="var(--kon-shade)" opacity={pocket.id === filedPocket ? 0.75 : 0.36} scale={0.6} />
                <span className="shelf__name">{pocket.name}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="result" aria-live="polite">
          {result && phase === 'filed' ? (
            <motion.div className="result__body" key={result.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <p className="result__pocket">Filed in {pocketById(result.pocket).name}</p>
              <h3>{result.title}</h3>
              <p className="result__prompt">{result.prompt}</p>
              <div className="result__actions">
                <button
                  className="button button--primary"
                  onClick={() => {
                    void navigator.clipboard?.writeText(result.prompt).catch(() => undefined)
                    setCopied(true)
                  }}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {copied ? 'Prompt copied' : 'Copy prompt'}
                </button>
                <button className="button button--paper" onClick={replay}>
                  <RetryIcon />
                  Snip again
                </button>
              </div>
            </motion.div>
          ) : (
            <p className="result__waiting">
              {phase === 'filing' ? 'The model is reading the snip and your note.' : 'The prompt for your snip appears here.'}
            </p>
          )}
      </div>
    </div>
  )
}
