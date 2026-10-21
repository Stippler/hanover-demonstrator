import { Page } from "@playwright/test";
import { appUrl } from "../playwright.config";

export { appUrl };

const DEMO_USER = process.env.E2E_USER ?? "demo";
const DEMO_PASS = process.env.E2E_PASSWORD ?? "demo";

export async function loginAt(
  page: Page,
  app: "vendor" | "vault-a" | "vault-b" | "service" | "admin"
) {
  await page.goto(appUrl(app));
  await page.locator("#login-username").fill(DEMO_USER);
  await page.locator("#login-password").fill(DEMO_PASS);
  await page.locator("#login-password").press("Enter");
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15_000 });
}

export async function ensureLoggedInVendor(page: Page): Promise<void> {
  await page.goto(appUrl("vendor"));
  if (page.url().includes("/login")) {
    await loginAt(page, "vendor");
  }
}

export async function ensureLoggedInVaultA(page: Page): Promise<void> {
  await page.goto(appUrl("vault-a"));
  if (page.url().includes("/login")) {
    await loginAt(page, "vault-a");
  }
}

export async function ensureLoggedInVaultB(page: Page): Promise<void> {
  await page.goto(appUrl("vault-b"));
  if (page.url().includes("/login")) {
    await loginAt(page, "vault-b");
  }
}

export async function ensureLoggedInService(page: Page): Promise<void> {
  await page.goto(appUrl("service"));
  if (page.url().includes("/login")) {
    await loginAt(page, "service");
  }
}

export async function ensureLoggedInAdmin(page: Page): Promise<void> {
  await page.goto(appUrl("admin"));
  if (page.url().includes("/login")) {
    await loginAt(page, "admin");
  }
}
