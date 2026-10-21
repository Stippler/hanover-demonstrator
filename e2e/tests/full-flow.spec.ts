import { test, expect } from "@playwright/test";
import {
  appUrl,
  loginAt,
  ensureLoggedInVendor,
  ensureLoggedInVaultA,
  ensureLoggedInVaultB,
  ensureLoggedInService,
  ensureLoggedInAdmin,
} from "./helpers";

test.describe("Full flow: create ski, transfer, accept, service, admin view", () => {
  test("Create ski on Vendor, transfer to VaultA, accept on VaultA, transfer to VaultB, accept on VaultB, view on Service, verify on Admin", async ({
    page,
  }) => {
    const modelName = `E2E Ski ${Date.now()}`;
    const manufacturer = "E2E Mfg";

    // —— Vendor: login and create ski ——
    await loginAt(page, "vendor");
    await page.getByRole("link", { name: /create|product pass/i }).click();
    await expect(page).toHaveURL(/\/create/);
    await page.getByPlaceholder(/alpine pro|ski model/i).first().fill(modelName);
    await page.getByPlaceholder(/alpine ski manufacturing|manufacturer/i).first().fill(manufacturer);
    await page.getByRole("button", { name: /create passport|creating/i }).click();
    await expect(page.getByText(/created|redirecting/i)).toBeVisible({ timeout: 10_000 });
    await page.waitForURL(/\/inventory/, { timeout: 15_000 });
    await expect(page.getByText(modelName)).toBeVisible({ timeout: 5000 });

    // Get ski id from inventory: click the ski link or read from DOM
    const skiLink = page.getByRole("link", { name: new RegExp(modelName) }).first();
    await skiLink.click();
    await page.waitForURL(/\/ski\/[a-f0-9-]+/);
    const skiId = page.url().split("/ski/")[1]?.split("/")[0]?.split("?")[0];
    expect(skiId).toBeTruthy();
    expect(skiId!.length).toBeGreaterThan(30);

    // —— Vendor: initiate transfer to owner_a ——
    await page.goto(appUrl("vendor"));
    await page.getByRole("link", { name: /sell|transfer/i }).click();
    await expect(page).toHaveURL(/\/transfer/);
    await page.locator("select").first().selectOption({ label: new RegExp(modelName) });
    await page.getByPlaceholder(/owner_a|buyer|e\.g\. owner/i).fill("owner_a");
    await page.getByRole("button", { name: /initiate transfer/i }).click();
    await expect(page.getByText(/after initiating|buyer opens/i)).toBeVisible({ timeout: 5000 });

    // —— VaultA: accept incoming transfer ——
    await page.goto(appUrl("vault-a"));
    if (page.url().includes("/login")) await loginAt(page, "vault-a");
    await page.getByRole("link", { name: /transfers/i }).click();
    await expect(page).toHaveURL(/\/transfer/);
    await expect(page.getByText(modelName).or(page.getByText(/incoming|pending/i))).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /accept/i }).first().click();
    await expect(page.getByText(/completed|history/i)).toBeVisible({ timeout: 10_000 });

    // —— VaultA: initiate transfer to owner_b ——
    await page.getByRole("button", { name: /send/i }).first().click();
    await page.locator("select").first().selectOption({ label: new RegExp(modelName) });
    await page.getByPlaceholder(/participant|owner_b|e\.g\. owner/i).fill("owner_b");
    await page.getByRole("button", { name: /initiate transfer/i }).click();
    await expect(page.getByText(/pending outgoing|history/i)).toBeVisible({ timeout: 8000 });

    // —— VaultB: accept incoming transfer ——
    await page.goto(appUrl("vault-b"));
    if (page.url().includes("/login")) await loginAt(page, "vault-b");
    await page.getByRole("link", { name: /transfers/i }).click();
    await expect(page).toHaveURL(/\/transfer/);
    await expect(page.getByText(modelName).or(page.getByText(/incoming|pending/i))).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /accept/i }).first().click();
    await expect(page.getByText(/completed|history/i)).toBeVisible({ timeout: 10_000 });

    // —— Service: look up ski by ID and view passport ——
    await page.goto(appUrl("service"));
    if (page.url().includes("/login")) await loginAt(page, "service");
    await page.getByRole("link", { name: /scan/i }).click();
    await expect(page).toHaveURL(/\/scan/);
    await page.getByRole("button", { name: /manual/i }).click();
    await page.getByPlaceholder(/enter ski id|ski-id|eingeben/i).fill(skiId!);
    await page.locator("form").filter({ has: page.getByPlaceholder(/enter ski id|ski-id|eingeben/i) }).getByRole("button").click();
    await expect(page.getByText(modelName).or(page.getByText(/view product pass|view passport/i))).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /view product pass|view passport/i }).click();
    await expect(page).toHaveURL(new RegExp(`/scan/${skiId}`));
    await expect(page.getByText(/owner_b|current owner|identity/i)).toBeVisible({ timeout: 8000 });

    // —— Admin: verify passport and transfers ——
    await page.goto(appUrl("admin"));
    if (page.url().includes("/login")) await loginAt(page, "admin");
    await page.getByRole("link", { name: /product passes/i }).click();
    await expect(page).toHaveURL(/\/passports/);
    await expect(page.getByText(modelName)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/owner_b|Owner Cloud B/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole("link", { name: /transfers/i }).click();
    await expect(page).toHaveURL(/\/transfers/);
    await expect(page.getByText(modelName).or(page.getByText(/vendor|owner_a|owner_b/))).toBeVisible({ timeout: 8000 });
  });
});
