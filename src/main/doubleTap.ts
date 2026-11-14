export interface KeyEvent {
  type: 'down' | 'up'
  keycode: number
  /** Milliseconds; only differences matter. */
  time: number
}

export interface DoubleTapOptions {
  /** Longest pause between the two taps. */
  gapMs?: number
  /** Longest a key may be held and still count as a tap. */
  holdMs?: number
}

/**
 * Recognises a double-tap of one key from a stream of global key events.
 * Holding the key, or pressing any other key during or between the taps,
 * cancels it, so ordinary shortcuts such as ⌘C never trigger.
 */
export function createDoubleTapDetector(
  keycode: number,
  onDoubleTap: () => void,
  { gapMs = 380, holdMs = 320 }: DoubleTapOptions = {}
): (event: KeyEvent) => void {
  let pressedAt: number | null = null
  let lastTapAt: number | null = null

  return (event) => {
    if (event.keycode !== keycode) {
      // Any other key breaks the sequence.
      if (event.type === 'down') {
        pressedAt = null
        lastTapAt = null
      }
      return
    }

    if (event.type === 'down') {
      // Ignore auto-repeat while the key is held.
      if (pressedAt === null) pressedAt = event.time
      return
    }

    const wasTap = pressedAt !== null && event.time - pressedAt <= holdMs
    pressedAt = null
    if (!wasTap) {
      lastTapAt = null
      return
    }
    if (lastTapAt !== null && event.time - lastTapAt <= gapMs) {
      lastTapAt = null
      onDoubleTap()
    } else {
      lastTapAt = event.time
    }
  }
}
