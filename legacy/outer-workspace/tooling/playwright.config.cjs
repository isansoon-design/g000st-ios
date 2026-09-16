const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [['list']],
  use: {
    headless: false,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
});
