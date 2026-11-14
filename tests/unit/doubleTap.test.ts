import { describe, expect, it, vi } from 'vitest'
import { createDoubleTapDetector, type KeyEvent } from '../../src/main/doubleTap'

const KEY = 3676
const OTHER = 46

/** Feeds a sequence of [type, keycode, time] events and reports how often the double-tap fired. */
function fired(events: [KeyEvent['type'], number, number][]): number {
  const onDoubleTap = vi.fn()
  const detect = createDoubleTapDetector(KEY, onDoubleTap)
  for (const [type, keycode, time] of events) detect({ type, keycode, time })
  return onDoubleTap.mock.calls.length
}

describe('double-tap detector', () => {
  it('fires once for two quick taps', () => {
    expect(fired([['down', KEY, 0], ['up', KEY, 60], ['down', KEY, 180], ['up', KEY, 240]])).toBe(1)
  })

  it('needs a fresh pair for each trigger', () => {
    const taps: [KeyEvent['type'], number, number][] = [0, 150, 300].flatMap((start) => [
      ['down', KEY, start],
      ['up', KEY, start + 50]
    ])
    expect(fired(taps)).toBe(1)
  })

  it('ignores taps that are too far apart', () => {
    expect(fired([['down', KEY, 0], ['up', KEY, 60], ['down', KEY, 900], ['up', KEY, 960]])).toBe(0)
  })

  it('ignores a held key, including its auto-repeat', () => {
    expect(fired([['down', KEY, 0], ['down', KEY, 400], ['up', KEY, 800], ['down', KEY, 900], ['up', KEY, 950]])).toBe(0)
  })

  it('does not fire when the key is used as a modifier for a shortcut', () => {
    expect(
      fired([['down', KEY, 0], ['down', OTHER, 40], ['up', OTHER, 80], ['up', KEY, 100], ['down', KEY, 200], ['up', KEY, 250]])
    ).toBe(0)
  })

  it('does not fire when another key is pressed between the taps', () => {
    expect(
      fired([['down', KEY, 0], ['up', KEY, 50], ['down', OTHER, 100], ['up', OTHER, 130], ['down', KEY, 200], ['up', KEY, 250]])
    ).toBe(0)
  })
})
