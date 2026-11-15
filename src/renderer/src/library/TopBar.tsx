import { useEffect, useRef } from 'react'
import { api, KEY, shortcutKeys } from '../bridge'
import { CloseIcon, SearchIcon, SlidersIcon, SnipIcon } from '../ui/icons'

interface TopBarProps {
  query: string
  onQuery(query: string): void
  shortcut: string
  onSettings(): void
  onHome(): void
}

/** The app mark: a stitched patch with the snip brackets and one red knot. */
function Mark() {
  return (
    <svg className="mark" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <rect x="1.5" y="1.5" width="25" height="25" rx="7" fill="var(--kon)" />
      <rect
        x="4.5"
        y="4.5"
        width="19"
        height="19"
        rx="4.5"
        fill="none"
        stroke="var(--thread)"
        strokeWidth="1.3"
        strokeDasharray="2.6 2.2"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M10 12.5V10h2.5M15.5 10H18v2.5M18 15.5V18h-2.5M12.5 18H10v-2.5"
        fill="none"
        stroke="var(--thread)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21.2" cy="21.2" r="1.9" fill="var(--akane)" />
    </svg>
  )
}

export function TopBar({ query, onQuery, shortcut, onSettings, onHome }: TopBarProps) {
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="topbar">
      <button className="brand" onClick={onHome} aria-label="Pokke, all pockets">
        <Mark />
        <span>Pokke</span>
      </button>

      <label className="search">
        <SearchIcon />
        <input
          ref={input}
          type="text"
          value={query}
          placeholder="Search"
          aria-label="Search snips"
          spellCheck={false}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onQuery('')
              event.currentTarget.blur()
            }
          }}
        />
        {query ? (
          <button className="search__clear" aria-label="Clear search" onClick={() => onQuery('')}>
            <CloseIcon />
          </button>
        ) : (
          <span className="search__keys" aria-hidden="true">
            <kbd className="keycap">{KEY.mod}</kbd>
            <kbd className="keycap">K</kbd>
          </span>
        )}
      </label>

      <div className="topbar__actions">
        <button className="snip-button" onClick={() => void api.capture.start()}>
          <SnipIcon />
          <span>Snip</span>
          <span className="snip-button__keys" aria-hidden="true">
            {shortcutKeys(shortcut).map((key) => (
              <kbd className="keycap" key={key}>
                {key}
              </kbd>
            ))}
          </span>
        </button>
        <button className="icon-button" aria-label="Settings" onClick={onSettings}>
          <SlidersIcon />
        </button>
      </div>
    </header>
  )
}
