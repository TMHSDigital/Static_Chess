import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: '.',
  outputDir: '../../test-results/browser',
  use: { ...devices['Desktop Chrome'], baseURL },
  webServer: {
    command: 'python -m http.server 4173 --bind 127.0.0.1',
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    url: baseURL,
    stderr: 'ignore',
  },
});
