import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  webServer: {
    command: 'node server/dist/index.js',
    cwd: '../',
    url: 'http://localhost:4000/health',
    reuseExistingServer: true,
    timeout: 15000
  },
  use: {
    baseURL: 'http://localhost:4000',
    screenshot: 'on',
    video: 'off'
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 }
      }
    }
  ]
});
