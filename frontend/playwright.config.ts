import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_URL || "http://127.0.0.1:5187";
const hosted = baseURL.startsWith("https://");

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: hosted ? 180000 : 90000,
  expect: { timeout: hosted ? 20000 : 5000 },
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "../artifacts/verification/browser-results.json" }],
  ],
});
