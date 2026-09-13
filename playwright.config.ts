import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './out/test-results/artifacts',
  snapshotPathTemplate: './tests/visual/__screenshots__/{arg}{ext}',
  reporter: [['list'], ['html', { outputFolder: './out/test-results/report', open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure'
  }
});
