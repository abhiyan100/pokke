import type { ReactNode } from 'react'

function icon(children: ReactNode) {
  return function Icon() {
    return (
      <svg className="icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        {children}
      </svg>
    )
  }
}

export const SearchIcon = icon(
  <>
    <circle cx="9" cy="9" r="5.2" />
    <path d="M13 13l3.6 3.6" />
  </>
)

/** Four corner brackets: the snip mark. */
export const SnipIcon = icon(<path d="M3.5 7.5v-4h4M12.5 3.5h4v4M16.5 12.5v4h-4M7.5 16.5h-4v-4" />)

export const SlidersIcon = icon(
  <>
    <path d="M3.5 6h6M13.5 6h3M3.5 14h3M10.5 14h6" />
    <circle cx="11.5" cy="6" r="2" />
    <circle cx="8.5" cy="14" r="2" />
  </>
)

export const CopyIcon = icon(
  <>
    <rect x="7" y="7" width="9.5" height="9.5" rx="2.2" />
    <path d="M13 4.2a2 2 0 00-1.7-.7H5.5a2 2 0 00-2 2v5.8a2 2 0 00.7 1.7" />
  </>
)

export const ImageIcon = icon(
  <>
    <rect x="3.5" y="4.5" width="13" height="11" rx="2.2" />
    <circle cx="7.6" cy="8.4" r="1.2" />
    <path d="M4.5 14l3.6-3.4 2.6 2.2 2.2-1.8 3 2.6" />
  </>
)

export const CheckIcon = icon(<path d="M4.5 10.5l3.6 3.6 7.4-8" />)

export const CloseIcon = icon(<path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />)

export const BackIcon = icon(<path d="M11.5 4.5L6 10l5.5 5.5" />)

export const TrashIcon = icon(
  <>
    <path d="M4.5 6h11M8 6V4.5h4V6M6 6l.6 9a1.5 1.5 0 001.5 1.4h3.8a1.5 1.5 0 001.5-1.4L14 6" />
  </>
)

export const RetryIcon = icon(
  <>
    <path d="M15.5 10a5.5 5.5 0 11-1.8-4.1" />
    <path d="M14.2 3.2v3h-3" />
  </>
)

export const FolderIcon = icon(
  <path d="M3.5 6.5a1.5 1.5 0 011.5-1.5h3l1.6 1.8h5.4a1.5 1.5 0 011.5 1.5v5.2a1.5 1.5 0 01-1.5 1.5H5a1.5 1.5 0 01-1.5-1.5z" />
)

export const ChevronIcon = icon(<path d="M6 8l4 4 4-4" />)

export const AlertIcon = icon(
  <>
    <path d="M10 6.5v4.2" />
    <circle cx="10" cy="13.6" r="0.4" />
    <circle cx="10" cy="10" r="7" />
  </>
)
