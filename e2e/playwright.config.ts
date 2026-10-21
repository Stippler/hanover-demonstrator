import { defineConfig, devices } from "@playwright/test";

const E2E_DOMAIN = process.env.E2E_DOMAIN ?? "imx.vactory-projects.com";
const E2E_PORT = process.env.E2E_PORT ?? "8100";
const E2E_USE_HTTPS = process.env.E2E_USE_HTTPS === "true";
const scheme = E2E_USE_HTTPS ? "https" : "http";
const portSuffix = E2E_PORT === "80" || E2E_PORT === "443" ? "" : `:${E2E_PORT}`;

export function appUrl(app: string): string {
  return `${scheme}://${app}.${E2E_DOMAIN}${portSuffix}`;
}

export default defineConfig({
  testDir: "tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: appUrl("vendor"),
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
