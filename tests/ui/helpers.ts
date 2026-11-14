import type { Page } from '@playwright/test'

/** What the mock bridge recorded the UI asking for. */
export function recorded<T = unknown>(page: Page, key: string): Promise<T | undefined> {
  return page.evaluate((name) => (window as unknown as { __mock: Record<string, T> }).__mock[name], key)
}

export async function drag(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  await page.mouse.move(...from)
  await page.mouse.down()
  await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 })
  await page.mouse.move(...to, { steps: 4 })
  await page.mouse.up()
}
