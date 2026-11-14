import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { POCKETS, pocketById } from '@shared/pockets'
import type { CopyKind, Snip } from '@shared/types'
import { api, KEY } from '../bridge'
import { Pattern } from '../ui/Pattern'
import { Stitch } from '../ui/Stitch'
import {
  AlertIcon,
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  CopyIcon,
  FolderIcon,
  ImageIcon,
  RetryIcon,
  TrashIcon
} from '../ui/icons'
import { fade, sheet, travel } from '../ui/motion'
import { formatWhen, snipLabel } from './snips'

interface SnipSheetProps {
  snip: Snip
  /** Other snips with tags in common, closest first. */
  related: Snip[]
  hasModel: boolean
  onClose(): void
  /** Step to the neighbouring snip in the list the sheet was opened from. */
  onStep(direction: -1 | 1): void
  /** Open another snip in place of this one. */
  onOpen(id: string): void
  onSettings(): void
}

const COPIED_MS = 1600

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
}

/** A text field that saves when focus leaves it, and resets if the snip changes underneath. */
function useDraft(value: string, save: (next: string) => void) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return {
    value: draft,
    onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
    onBlur: () => {
      if (draft !== value) save(draft)
    }
  }
}

function PocketPicker({ snip }: { snip: Snip }) {
  const [open, setOpen] = useState(false)
  const pocket = pocketById(snip.pocket)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="picker" ref={root}>
      <button className="picker__button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="picker__swatch cloth" aria-hidden="true">
          <Pattern pattern={pocket.pattern} opacity={0.8} scale={0.5} />
        </span>
        <span>{pocket.name}</span>
        <ChevronIcon />
      </button>
      {open && (
        <ul className="picker__menu" role="listbox" aria-label="Move to pocket">
          {POCKETS.map((option) => (
            <li key={option.id} role="option" aria-selected={option.id === snip.pocket}>
              <button
                onClick={() => {
                  setOpen(false)
                  if (option.id !== snip.pocket) void api.snips.update(snip.id, { pocket: option.id })
                }}
              >
                <span className="picker__swatch cloth" aria-hidden="true">
                  <Pattern pattern={option.pattern} opacity={0.8} scale={0.5} />
                </span>
                {option.name}
                {option.id === snip.pocket && <CheckIcon />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Swatches({ colours }: { colours: string[] }) {
  const [copied, setCopied] = useState<string | null>(null)
  if (colours.length === 0) return null
  return (
    <div className="swatches" role="group" aria-label="Colours in this snip">
      {colours.map((colour) => (
        <button
          key={colour}
          className="swatch"
          style={{ background: colour }}
          aria-label={`Copy ${colour}`}
          title={colour}
          onClick={() => {
            void navigator.clipboard.writeText(colour).catch(() => undefined)
            setCopied(colour)
            setTimeout(() => setCopied(null), COPIED_MS)
          }}
        />
      ))}
      <span className="swatches__hint" aria-live="polite">
        {copied ? `${copied} copied` : ''}
      </span>
    </div>
  )
}

function Tags({ snip }: { snip: Snip }) {
  const [draft, setDraft] = useState('')
  const save = (tags: string[]) => void api.snips.update(snip.id, { tags })
  return (
    <div className="slip__tags">
      {snip.tags.map((tag) => (
        <span className="chip" key={tag}>
          {tag}
          <button aria-label={`Remove tag ${tag}`} onClick={() => save(snip.tags.filter((other) => other !== tag))}>
            <CloseIcon />
          </button>
        </span>
      ))}
      <input
        className="chip chip--input"
        value={draft}
        placeholder="Add tag"
        aria-label="Add tag"
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          const tag = draft.trim().toLowerCase()
          if (event.key === 'Enter' && tag) {
            if (!snip.tags.includes(tag)) save([...snip.tags, tag])
            setDraft('')
          }
        }}
      />
    </div>
  )
}

export function SnipSheet({ snip, related, hasModel, onClose, onStep, onOpen, onSettings }: SnipSheetProps) {
  // Which copy just happened, so the other button can be marked as the next step.
  const [copied, setCopied] = useState<CopyKind | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const title = useDraft(snip.title, (next) => void api.snips.update(snip.id, { title: next.trim() }))
  const note = useDraft(snip.note, (next) => void api.snips.update(snip.id, { note: next.trim() }))
  const prompt = useDraft(snip.prompt, (next) => void api.snips.update(snip.id, { prompt: next }))

  const copy = (kind: CopyKind) => {
    if (kind === 'prompt' && !snip.prompt) return
    api.snips
      .copy(snip.id, kind)
      .then(() => {
        setCopied(kind)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(null), COPIED_MS * 2.5)
      })
      .catch(() => setCopied(null))
  }

  // The app refuses when no model is usable; the buttons that call this are only shown when one is.
  const analyze = () => void api.snips.analyze(snip.id).catch(() => undefined)

  useEffect(() => {
    setCopied(null)
    setConfirmDelete(false)
  }, [snip.id])

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isTyping(event.target)) (event.target as HTMLElement).blur()
        else onClose()
        return
      }
      if (isTyping(event.target)) return
      if (event.key === 'ArrowLeft') onStep(-1)
      if (event.key === 'ArrowRight') onStep(1)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c' && !getSelection()?.toString()) {
        event.preventDefault()
        copy(event.shiftKey ? 'image' : 'prompt')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const tall = snip.height / snip.width > 1.5
  const ready = snip.status === 'ready' || snip.prompt !== ''

  return (
    <motion.div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label={snipLabel(snip)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={fade}
    >
      <div className="sheet__stage" data-tall={tall || undefined} onClick={onClose}>
        <motion.div
          className="paper paper--stage"
          layoutId={`snip-${snip.id}`}
          transition={travel}
          onClick={(event) => event.stopPropagation()}
        >
          <img src={snip.imageUrl} alt={snip.summary || snipLabel(snip)} draggable={false} />
        </motion.div>
      </div>

      <motion.aside
        className="slip"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={sheet}
      >
        <Stitch inset={8} radius={13} tone="ink" />

        <div className="slip__scroll">
          <div className="slip__top">
            <PocketPicker snip={snip} />
            <button className="icon-button icon-button--ink" aria-label="Close" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>

          <textarea className="slip__title" aria-label="Title" placeholder="Untitled snip" rows={1} spellCheck={false} {...title} />
          {snip.summary && <p className="slip__summary">{snip.summary}</p>}

          <label className="slip__note">
            <span className="visually-hidden">Your note</span>
            <input placeholder="Add a note" spellCheck={false} {...note} />
          </label>

          <section className="slip__prompt" aria-label="Prompt">
            <header>
              <h2>Prompt</h2>
              {hasModel && snip.status !== 'analyzing' && (
                <button className="text-button" onClick={analyze}>
                  <RetryIcon />
                  Rewrite
                </button>
              )}
            </header>

            {snip.status === 'analyzing' ? (
              <div className="slip__state">
                <Stitch inset={0} radius={10} tone="accent" marching />
                <p>Writing the prompt…</p>
              </div>
            ) : snip.status === 'failed' ? (
              <div className="slip__state slip__state--problem">
                <AlertIcon />
                <p>{snip.error ?? 'The model could not file this snip.'}</p>
                {hasModel ? (
                  <button className="button button--ink" onClick={analyze}>
                    Try again
                  </button>
                ) : (
                  <button className="button button--ink" onClick={onSettings}>
                    Choose a model
                  </button>
                )}
              </div>
            ) : !ready ? (
              <div className="slip__state">
                <p>Saved. Choose a model and it will be filed with a prompt.</p>
                <button className="button button--ink" onClick={onSettings}>
                  Choose a model
                </button>
              </div>
            ) : (
              <textarea aria-label="Prompt text" spellCheck={false} {...prompt} />
            )}
          </section>

          <Swatches colours={snip.palette} />
          <Tags snip={snip} />

          {related.length > 0 && (
            <section className="slip__related" aria-label="More like this">
              <h2>More like this</h2>
              <div className="slip__related-row">
                {related.map((other) => (
                  <button
                    key={other.id}
                    className="slip__related-item"
                    aria-label={`Open ${snipLabel(other)}`}
                    title={snipLabel(other)}
                    onClick={() => onOpen(other.id)}
                  >
                    <img src={other.thumbUrl} alt="" draggable={false} />
                  </button>
                ))}
              </div>
            </section>
          )}

          <footer className="slip__meta">
            <span className="slip__facts">
              <span>{formatWhen(snip.createdAt)}</span>
              <span>
                {snip.width} × {snip.height}
              </span>
            </span>
            <span className="slip__meta-actions">
              <button className="icon-button icon-button--ink" aria-label="Show file" title="Show file" onClick={() => void api.snips.reveal(snip.id)}>
                <FolderIcon />
              </button>
              {confirmDelete ? (
                <button
                  className="text-button text-button--danger"
                  autoFocus
                  onBlur={() => setConfirmDelete(false)}
                  onClick={() => {
                    onClose()
                    void api.snips.remove(snip.id)
                  }}
                >
                  Delete snip
                </button>
              ) : (
                <button className="icon-button icon-button--ink" aria-label="Delete" title="Delete" onClick={() => setConfirmDelete(true)}>
                  <TrashIcon />
                </button>
              )}
            </span>
          </footer>
        </div>

        <div className="slip__copy">
          <button className="button button--primary" disabled={!snip.prompt} data-next={copied === 'image' || undefined} onClick={() => copy('prompt')}>
            {copied === 'prompt' ? <CheckIcon /> : <CopyIcon />}
            <span>{copied === 'prompt' ? 'Prompt copied' : 'Copy prompt'}</span>
            <kbd className="keycap">{KEY.mod}C</kbd>
          </button>
          <button className="button button--paper" data-next={copied === 'prompt' || undefined} onClick={() => copy('image')}>
            {copied === 'image' ? <CheckIcon /> : <ImageIcon />}
            <span>{copied === 'image' ? 'Image copied' : 'Copy image'}</span>
          </button>
        </div>
      </motion.aside>
    </motion.div>
  )
}
