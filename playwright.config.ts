import { defineConfig, devices } from '@playwright/test'

/**
 * E2E draait tegen een productiebuild.
 *
 * Dat is bewust: de service worker wordt alleen buiten development
 * geregistreerd, en zonder actieve service worker is het offline-scenario
 * (herladen zonder verbinding) niet echt te testen.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
  webServer: {
    command: process.env.BASE_URL ? 'echo "externe server"' : 'npm run build && npm run start',
    url: process.env.BASE_URL ?? 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})
