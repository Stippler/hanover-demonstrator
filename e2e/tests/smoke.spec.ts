import { test, expect } from "@playwright/test";
import { appUrl, loginAt } from "./helpers";

test.describe("Smoke: login and dashboard on each app", () => {
  test("Vendor: login and see dashboard/inventory", async ({ page }) => {
    await loginAt(page, "vendor");
    await expect(page).toHaveURL(new RegExp(appUrl("vendor").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/?($|#)"));
    await expect(page.getByText(/dashboard|inventory|ski vendor/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("VaultA: login and see vault/inventory", async ({ page }) => {
    await loginAt(page, "vault-a");
    await expect(page).toHaveURL(new RegExp(appUrl("vault-a").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/?($|#)"));
    await expect(page.getByText(/vault|inventory|dashboard/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("VaultB: login and see vault", async ({ page }) => {
    await loginAt(page, "vault-b");
    await expect(page).toHaveURL(new RegExp(appUrl("vault-b").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/?($|#)"));
    await expect(page.getByText(/vault|inventory|dashboard/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("Service: login and see scan/dashboard", async ({ page }) => {
    await loginAt(page, "service");
    await expect(page).toHaveURL(new RegExp(appUrl("service").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/?($|#)"));
    await expect(page.getByText(/scan|peak service|history/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("Admin: login and see Demonstrator Dashboard", async ({ page }) => {
    await loginAt(page, "admin");
    await expect(page).toHaveURL(new RegExp(appUrl("admin").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/?($|#)"));
    await expect(page.getByText(/demonstrator dashboard|system overview|product passes/i).first()).toBeVisible({ timeout: 8000 });
  });
});
