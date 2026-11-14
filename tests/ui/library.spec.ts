import { expect, test } from '@playwright/test'
import { recorded } from './helpers'

test('open a pocket, open a snip, copy its prompt then its image', async ({ page }) => {
  await page.goto('/library.html')
  await page.getByRole('button', { name: 'Design, 4 snips' }).click()
  await expect(page.getByRole('heading', { name: 'Design' })).toBeVisible()
  await expect(page.locator('.card')).toHaveCount(4)

  await page.getByRole('button', { name: 'Open Editorial hero with oversized serif numerals' }).click()
  const sheet = page.getByRole('dialog', { name: 'Editorial hero with oversized serif numerals' })
  await expect(sheet.getByLabel('Prompt text')).toHaveValue(/^Build the hero section for \[what I'm building\]/)

  await sheet.getByRole('button', { name: 'Copy prompt' }).click()
  await expect(sheet.getByRole('button', { name: 'Prompt copied' })).toBeVisible()
  expect(await recorded(page, 'copied')).toEqual({ id: 'sample-1', kind: 'prompt' })
  // The other half of the pair is marked as the next step.
  await expect(sheet.getByRole('button', { name: 'Copy image' })).toHaveAttribute('data-next', 'true')

  await sheet.getByRole('button', { name: 'Copy image' }).click()
  expect(await recorded(page, 'copied')).toEqual({ id: 'sample-1', kind: 'image' })

  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog', { name: 'Dark finance home with lime balance card' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('search finds snips by their words across pockets', async ({ page }) => {
  await page.goto('/library.html')
  await expect(page.locator('.pocket')).toHaveCount(7)
  // Headless pages only receive key events once they have been clicked, so click an empty spot first.
  await page.locator('.topbar').click({ position: { x: 300, y: 8 } })
  // The shortcut puts the cursor in the search field, so typing goes straight there.
  await page.keyboard.press('ControlOrMeta+k')
  await page.keyboard.type('ffmpeg gif')
  await expect(page.getByLabel('Search snips')).toHaveValue('ffmpeg gif')
  await expect(page.locator('.card')).toHaveCount(1)
  await expect(page.locator('.card__title')).toHaveText('ffmpeg: screen recording to small MP4 and GIF')

  await page.getByLabel('Search snips').fill('no such thing anywhere')
  await expect(page.getByText('Nothing matches.')).toBeVisible()

  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(page.locator('.pocket')).toHaveCount(7)
})

test('a snip can be refiled, retitled and deleted by hand', async ({ page }) => {
  await page.goto('/library.html')
  await page.getByRole('button', { name: 'Ideas, 1 snip' }).click()
  await page.getByRole('button', { name: /^Open Onboarding/ }).click()
  const sheet = page.getByRole('dialog')
  // The research note shares the "onboarding" tag, so it is offered as more like this.
  await expect(sheet.getByRole('region', { name: 'More like this' }).getByRole('button')).toHaveCount(1)

  await sheet.getByRole('button', { name: 'Ideas' }).click()
  await sheet.getByRole('option', { name: 'Design' }).getByRole('button').click()
  await sheet.getByLabel('Title').fill('Annotated-screenshot onboarding')
  await sheet.getByLabel('Add tag').fill('Setup Flow')
  await sheet.getByLabel('Add tag').press('Enter')
  await expect(sheet.locator('.chip', { hasText: 'setup flow' })).toBeVisible()

  await sheet.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Back to all pockets' }).click()
  await expect(page.getByRole('button', { name: 'Design, 5 snips' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ideas, 0 snips' })).toBeVisible()

  await page.getByRole('button', { name: 'Design, 5 snips' }).click()
  await page.getByRole('button', { name: 'Open Annotated-screenshot onboarding' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('button', { name: 'Delete snip' }).click()
  await expect(page.locator('.card')).toHaveCount(4)
})

test('on Windows the shortcuts read as Ctrl and nothing asks for macOS access', async ({ page }) => {
  await page.goto('/library.html?platform=win32&fresh&empty')
  const welcome = page.getByRole('dialog', { name: 'Snip it. It files itself.' })
  await expect(welcome.getByText('Right Ctrl')).toBeVisible()
  await expect(welcome.getByRole('button', { name: 'Allow' })).toHaveCount(0)
  await welcome.getByRole('button', { name: 'Start snipping' }).click()

  await expect(page.getByText('Double-tap to snip anything on screen')).toBeVisible()
  await expect(page.locator('.empty-hint .keycap').first()).toHaveText('Right Ctrl')
  await expect(page.locator('.snip-button__keys')).toHaveText('CtrlShift2')

  await page.getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  await expect(settings.getByRole('heading', { name: 'Snip shortcut' })).toBeVisible()
  await expect(settings.getByRole('heading', { name: 'Access' })).toHaveCount(0)
})

test('first run: allow access, choose a model, start snipping', async ({ page }) => {
  await page.goto('/library.html?fresh&blocked&empty')
  const welcome = page.getByRole('dialog', { name: 'Snip it. It files itself.' })
  await expect(welcome.getByRole('button', { name: 'Allow' })).toHaveCount(2)

  await welcome.getByRole('button', { name: 'Allow' }).first().click()
  expect(await recorded(page, 'asked')).toBe('screen')
  await expect(welcome.getByText('Allowed')).toHaveCount(2)

  await welcome.getByRole('button', { name: 'Choose' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  await settings.getByRole('radio', { name: /^OpenAI/ }).click()
  await settings.getByLabel('API key').fill('sk-test')
  await settings.getByRole('button', { name: 'Save key' }).click()
  await expect(settings.locator('#model-id')).toHaveValue('gpt-5.2')
  await expect(settings.getByText('New snips are filed by gpt-5.2')).toBeVisible()
  await settings.getByRole('button', { name: 'Close settings' }).click()

  await expect(welcome.getByText('gpt-5.2')).toBeVisible()
  await welcome.getByRole('button', { name: 'Start snipping' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Double-tap to snip anything on screen')).toBeVisible()

  // If Right ⌘ clashes with Siri, another right-hand key can take over the double-tap.
  await expect(page.locator('.empty-hint .keycap').first()).toHaveText('Right ⌘')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('radio', { name: 'Right ⌥' }).click()
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(page.locator('.empty-hint .keycap').first()).toHaveText('Right ⌥')
})
