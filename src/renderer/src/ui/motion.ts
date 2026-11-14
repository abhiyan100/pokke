import type { Transition } from 'motion/react'

/** Quick, firm response to a press or hover. */
export const snappy: Transition = { type: 'spring', stiffness: 420, damping: 34 }

/** Cards fanning, lifting and settling. */
export const settle: Transition = { type: 'spring', stiffness: 260, damping: 24 }

/** A snip travelling between its places: pocket, grid, full view. */
export const travel: Transition = { type: 'spring', visualDuration: 0.38, bounce: 0.16 }

/** Sheets and panels sliding in. */
export const sheet: Transition = { duration: 0.46, ease: [0.32, 0.72, 0, 1] }

export const fade: Transition = { duration: 0.18, ease: 'easeOut' }
