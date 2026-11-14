import { expect, test } from '@playwright/test'
import { drag, recorded } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/overlay.html')
  await expect(page.locator('.overlay')).toHaveAttribute('data-phase', 'aiming')
})

test('drag a region, type a note, press Enter: the snip is saved and flies to the corner', async ({ page }) => {
  await drag(page, [300, 200], [700, 450])

  await expect(page.locator('.overlay')).toHaveAttribute('data-phase', 'selected')
  await expect(page.locator('.size')).toHaveText('400 × 250')
  const note = page.getByLabel('Note for this snip')
  await expect(note).toBeFocused()

  await page.keyboard.type('hero idea')
  await page.keyboard.press('Enter')

  await expect.poll(() => recorded(page, 'saved')).toEqual({ rect: { x: 300, y: 200, width: 400, height: 250 }, note: 'hero idea' })
  // The overlay asks to be hidden only once the snip has landed.
  await expect(page.locator('html')).toHaveAttribute('data-capture', 'finished')
})

test('the selection can be nudged with arrows and resized by its handles before saving', async ({ page }) => {
  await drag(page, [300, 200], [700, 450])
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Shift+ArrowDown')
  await drag(page, [701, 460], [801, 510])
  await expect(page.locator('.size')).toHaveText('500 × 300')

  await page.getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => recorded(page, 'saved')).toEqual({ rect: { x: 301, y: 210, width: 500, height: 300 }, note: '' })
})

test('a stray click selects nothing, and Esc cancels the snip', async ({ page }) => {
  await page.mouse.click(400, 300)
  await expect(page.locator('.overlay')).toHaveAttribute('data-phase', 'aiming')
  await expect(page.locator('.selection')).toHaveCount(0)

  await drag(page, [300, 200], [700, 450])
  await page.keyboard.press('Escape')
  await expect(page.locator('html')).toHaveAttribute('data-capture', 'cancelled')
  await expect(page.locator('.selection')).toHaveCount(0)
  expect(await recorded(page, 'saved')).toBeUndefined()
})
