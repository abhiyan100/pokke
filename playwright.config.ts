import { defineConfig, devices } from '@playwright/test'

/**
 * ui   the three app pages in headless Chromium against the mock bridge
 * site the landing page in headless Chromium
 * app  the real Electron app in test mode: never shown, isolated data folder
 *      (needs `npm run build` first; `npm run test:app` does both)
 */
export default defineConfig({
  outputDir: 'test-results',
  reporter: [['list']],
  forbidOnly: Boolean(process.env.CI),
  projects: [
    {
      name: 'ui',
      testDir: 'tests/ui',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5199',
        viewport: { width: 1220, height: 820 }
      }
    },
    {
      name: 'site',
      testDir: 'tests/site',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5300',
        viewport: { width: 1440, height: 900 }
      }
    },
    {
      name: 'app',
      testDir: 'tests/app',
      timeout: 60_000
    }
  ],
  webServer: [
    {
      command: 'npm run ui:dev',
      url: 'http://localhost:5199/library.html',
      reuseExistingServer: true,
      timeout: 60_000
    },
    {
      command: 'npm run site:dev',
      url: 'http://localhost:5300/',
      reuseExistingServer: true,
      timeout: 60_000
    }
  ]
})
