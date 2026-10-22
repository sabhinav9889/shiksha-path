import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.ts',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 360, height: 640 },
    serviceWorkers: 'allow',
    locale: 'hi-IN',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /(speaking-mic|backend)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 640 } },
    },
    {
      // A fake microphone with permission granted, for the recording test only.
      name: 'chromium-mic',
      testMatch: /speaking-mic\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 640 },
        permissions: ['microphone'],
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        },
      },
    },
    // Against the local Supabase stack and the served api function: `npm run test:e2e:backend`.
    ...(process.env.E2E_BACKEND === '1'
      ? [
          {
            name: 'chromium-backend',
            testMatch: /backend\.spec\.ts/,
            use: {
              ...devices['Desktop Chrome'],
              viewport: { width: 360, height: 640 },
              permissions: ['microphone'],
              launchOptions: {
                args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
              },
            },
          },
        ]
      : []),
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
