import { expect, type Page } from '@playwright/test'
import type { XtractorApi } from '../../src/shared/api'

declare global {
  interface Window {
    xtractor?: XtractorApi
  }
}

/**
 * Starts a snip and waits until the overlay is showing the new frozen frame.
 * Waiting on the phase alone is not enough: after a cancelled snip the overlay
 * already reads "aiming", and a drag begun before the new frame arrives is
 * thrown away when it does.
 */
export async function freeze(library: Page, overlay: Page): Promise<void> {
  const frame = overlay.locator('.frame')
  const previous = (await frame.count()) > 0 ? await frame.getAttribute('src') : null
  await library.evaluate(() => window.xtractor!.capture.start())
  await expect.poll(async () => ((await frame.count()) > 0 ? frame.getAttribute('src') : null)).not.toBe(previous)
  await expect(overlay.locator('.overlay')).toHaveAttribute('data-phase', 'aiming')
}
