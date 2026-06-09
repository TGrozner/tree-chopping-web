import { defineConfig, devices } from '@playwright/test'

const host = '127.0.0.1'
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173)
const basePath = (process.env.VITE_BASE_PATH ?? '/').replace(/\/?$/, '/')
const baseURL = `http://${host}:${port}${basePath}`
const useProductionBuild = process.env.PLAYWRIGHT_USE_BUILD !== 'false'
const webServerCommand = useProductionBuild
  ? `npm run build && npm run preview -- --host ${host} --port ${port}`
  : `npm run dev -- --host ${host} --port ${port}`

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: webServerCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI && !useProductionBuild,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
