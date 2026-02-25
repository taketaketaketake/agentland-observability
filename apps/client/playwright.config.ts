import { defineConfig } from '@playwright/test';

const SERVER_PORT = 4444;
const CLIENT_PORT = 5174;
const TEST_DB = '/tmp/observability-e2e-test.db';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: [
    {
      command: `TEST_DB=${TEST_DB} SERVER_PORT=${SERVER_PORT} bun run start`,
      cwd: '../../apps/server',
      port: SERVER_PORT,
      reuseExistingServer: false,
    },
    {
      command: `VITE_API_URL=http://localhost:${SERVER_PORT} VITE_WS_URL=ws://localhost:${SERVER_PORT}/stream VITE_PORT=${CLIENT_PORT} npm run dev`,
      port: CLIENT_PORT,
      reuseExistingServer: false,
    },
  ],
});
