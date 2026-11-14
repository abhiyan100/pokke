import { expect, test } from '@playwright/test'

test('the cards in the hero pockets are real: one can be pulled out and opened with its prompt', async ({ page }) => {
  await page.goto('/')

  // Hovering a pocket draws its cards up and fans them out.
  const front = page.getByRole('button', { name: 'Open Editorial hero with oversized serif numerals, in Design' })
  const back = page.getByRole('button', { name: 'Open Rounded line icons with one accent each, in Design' })
  const tucked = (await front.boundingBox())!.y
  const tuckedBack = (await back.boundingBox())!.x
  await front.hover({ position: { x: 30, y: 30 } })
  await expect.poll(async () => (await front.boundingBox())!.y).toBeLessThan(tucked - 10)

  // Fanned out, every card still stands in the pocket: none hangs over the cloth beside it.
  await expect.poll(async () => (await back.boundingBox())!.x).toBeLessThan(tuckedBack - 10)
  await (await back.elementHandle())!.waitForElementState('stable')
  const beside = await back.evaluate((card) => {
    const pocket = card.parentElement!
    const { left, right, bottom } = pocket.getBoundingClientRect()
    const cardsAt = (x: number) => document.elementsFromPoint(x, bottom - 2).filter((el) => el !== pocket && pocket.contains(el))
    return cardsAt(left - 2).length + cardsAt(right + 2).length
  })
  expect(beside).toBe(0)

  // Clicking pulls the card out of the pocket and grows it into the full view.
  await front.click({ position: { x: 30, y: 30 } })
  const dialog = page.getByRole('dialog', { name: 'Editorial hero with oversized serif numerals' })
  await expect(dialog.getByText('Design', { exact: true })).toBeVisible()
  await expect(dialog.getByText(/^Build the hero section for \[what I'm building\]/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Copy prompt' }).click()
  await expect(dialog.getByRole('button', { name: 'Prompt copied' })).toBeVisible()

  // Closing sends it back to its pocket, with focus on the card that was opened.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(front).toBeFocused()
  await page.mouse.click(40, 400)
  await expect.poll(async () => Math.round((await front.boundingBox())!.y)).toBe(Math.round(tucked))
})

test('the examples include a tool tip and a prompt, each filed in its own pocket', async ({ page }) => {
  await page.goto('/')
  const tip = page.getByRole('button', { name: 'Open CLI that trims tool output to save tokens, in Tools' })
  await tip.click({ position: { x: 30, y: 30 } })
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Tools', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await expect(page.getByRole('button', { name: 'Open Glass stat card on a mesh gradient, in Prompts' })).toBeVisible()
})
