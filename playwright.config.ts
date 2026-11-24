import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 2,
  timeout: 35_000,
  expect: {
    timeout: 8000,
    toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.006 },
  },
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    [
      "json",
      {
        outputFile:
          process.env.PLAYWRIGHT_JSON_OUTPUT_FILE ??
          "test-results/results.json",
      },
    ],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        deviceScaleFactor: 1,
        hasTouch: true,
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev:mocks",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
