import { expect, test } from '@playwright/test'
import { recorded } from './helpers'

test('the corner thumbnail follows the snip from filing to filed, and opens it on click', async ({ page }) => {
  await page.goto('/toast.html')
  const tab = page.getByRole('status')
  await expect(tab).toHaveText('Filing…')
  await expect(tab).toHaveText('DesignEditorial hero with oversized serif numerals')

  await page.getByRole('button', { name: 'Open this snip in the library' }).click()
  expect(await recorded(page, 'toastOpened')).toBe('sample-1')
})

test('a snip that could not be filed still says it was saved', async ({ page }) => {
  await page.goto('/toast.html?status=failed')
  await expect(page.getByRole('status')).toHaveText('Saved, not filed')
  await page.getByRole('button', { name: 'Dismiss' }).click({ force: true })
  await expect(page.locator('.toast')).toHaveCount(0)
})
