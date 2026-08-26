import type { Locator, Page } from "playwright-core";

/**
 * Public-site login drawer (Next.js `DrawerFormLogin`).
 * CSS module hashes change; keep IDs / names / aria labels as the stable keys.
 */
export const FALABELLA_LOGIN_SELECTORS = {
  drawer: '[class*="DrawerFormLogin_container"]',
  drawerForm: 'form[class*="DrawerFormLogin"]',
  rut: '#document, input[name="document"]',
  password: '#pass, input[name="pass"]',
  submit: '[class*="DrawerFormLogin"] button[type="submit"]',
  loanCalculator: '[class*="loanCalculator"]',
  legacyRut: '#rut, input[name="rut"], input[id*="rut" i]',
} as const;

export type FalabellaLoginSurface = "drawer" | "legacy" | "unknown";

/** Decide drawer vs two-step form from which RUT field is on screen. Drawer wins if both are. */
export function resolveFalabellaLoginSurface(input: {
  drawerRutVisible: boolean;
  legacyRutVisible: boolean;
}): FalabellaLoginSurface {
  if (input.drawerRutVisible) return "drawer";
  if (input.legacyRutVisible) return "legacy";
  return "unknown";
}

/** RUT as `12345678-9` (max 10 chars on the new field). Dots and spaces stripped. */
export function formatFalabellaLoginRut(rut: string): string {
  const noDots = rut.trim().replace(/[.\s]/g, "");
  if (noDots.includes("-")) return noDots;
  if (noDots.length < 2) return noDots;
  return `${noDots.slice(0, -1)}-${noDots.slice(-1)}`;
}

async function fillReactInput(locator: Locator, value: string): Promise<void> {
  await locator.waitFor({ state: "visible", timeout: 15_000 });
  await locator.click();
  await locator.fill("");
  await locator.fill(value);
  if ((await locator.inputValue()) === value) {
    await locator.blur();
    return;
  }
  await locator.evaluate((el, next) => {
    const input = el as HTMLInputElement;
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    proto?.set?.call(input, next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await locator.blur();
}

function falabellaLegacyRutField(page: Page): Locator {
  return page.getByRole("textbox", { name: /rut/i })
    .or(page.locator(FALABELLA_LOGIN_SELECTORS.legacyRut))
    .first();
}

async function waitForDrawerRut(rutField: Locator, timeout: number): Promise<boolean> {
  return rutField.waitFor({ state: "visible", timeout }).then(() => true).catch(() => false);
}

export async function openFalabellaLoginDrawer(page: Page, debugLog: string[]): Promise<boolean> {
  const drawer = page.locator(FALABELLA_LOGIN_SELECTORS.drawer);
  const rutField = page.locator(FALABELLA_LOGIN_SELECTORS.rut).first();
  if (await drawer.isVisible().catch(() => false)) {
    debugLog.push("[LOGIN] Drawer already open");
    return rutField.isVisible().catch(() => false);
  }

  const headerLogin = page.getByRole("button", { name: /^mi cuenta$/i }).first();
  if (await headerLogin.isVisible({ timeout: 8_000 }).catch(() => false)) {
    debugLog.push("[LOGIN] Opening drawer via Mi Cuenta");
    await headerLogin.click();
  } else {
    debugLog.push("[LOGIN] Mi Cuenta button not found, trying text match");
    await page.locator("a, button").filter({ hasText: /mi cuenta/i }).first().click({ timeout: 10_000 });
  }

  if (await waitForDrawerRut(rutField, 12_000)) return true;

  const surface = resolveFalabellaLoginSurface({
    drawerRutVisible: await rutField.isVisible().catch(() => false),
    legacyRutVisible: await falabellaLegacyRutField(page).isVisible().catch(() => false),
  });
  switch (surface) {
    case "drawer":
      return true;
    case "legacy":
      return false;
    case "unknown":
      break;
    default: {
      const _exhaustive: never = surface;
      return _exhaustive;
    }
  }

  debugLog.push("[LOGIN] Drawer RUT not visible, trying dropdown Ingresar / Mi cuenta");
  const ingresar = page.getByRole("button", { name: /^ingresar$/i }).first();
  if (await ingresar.isVisible().catch(() => false)) {
    await ingresar.click();
  }
  const miCuentaLink = page.getByRole("link", { name: /mi cuenta/i }).first();
  if (await miCuentaLink.isVisible().catch(() => false)) {
    await miCuentaLink.click();
  }

  if (await waitForDrawerRut(rutField, 12_000)) return true;

  debugLog.push("[LOGIN] Drawer RUT still not visible, will try legacy two-step form");
  return false;
}

export async function submitFalabellaDrawerLogin(
  page: Page,
  rut: string,
  password: string,
  debugLog: string[],
): Promise<void> {
  const formattedRut = formatFalabellaLoginRut(rut);
  debugLog.push(`[LOGIN] Filling drawer RUT (${formattedRut.length} chars, password ${password.length} chars)`);

  const rutInput = page.locator(FALABELLA_LOGIN_SELECTORS.rut).first();
  const passInput = page.locator(FALABELLA_LOGIN_SELECTORS.password).first();
  await fillReactInput(rutInput, formattedRut);
  await fillReactInput(passInput, password);

  const submit = page.locator(FALABELLA_LOGIN_SELECTORS.submit).first();
  await page.waitForFunction(
    (sel) => {
      const btn = document.querySelector(sel) as HTMLButtonElement | null;
      return !!btn && !btn.disabled;
    },
    FALABELLA_LOGIN_SELECTORS.submit,
    { timeout: 10_000 },
  ).catch(() => {
    debugLog.push("[LOGIN] Submit still disabled after fill, retrying with sequential typing");
  });

  if (await submit.isDisabled().catch(() => true)) {
    await rutInput.click();
    await rutInput.fill("");
    await rutInput.pressSequentially(formattedRut, { delay: 40 });
    await passInput.click();
    await passInput.fill("");
    await passInput.pressSequentially(password, { delay: 40 });
    await page.waitForFunction(
      (sel) => {
        const btn = document.querySelector(sel) as HTMLButtonElement | null;
        return !!btn && !btn.disabled;
      },
      FALABELLA_LOGIN_SELECTORS.submit,
      { timeout: 8_000 },
    );
  }

  debugLog.push("[LOGIN] Clicking drawer Ingresar");
  await submit.click();
}

export async function submitFalabellaLegacyLogin(
  page: Page,
  rut: string,
  password: string,
  debugLog: string[],
): Promise<void> {
  const formattedRut = formatFalabellaLoginRut(rut);
  debugLog.push("[LOGIN] Using legacy two-step form");

  const rutField = falabellaLegacyRutField(page);
  await fillReactInput(rutField, formattedRut);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);

  const passField = page.locator('input[type="password"]').first();
  await fillReactInput(passField, password);

  const submitBtn = page.locator('button[type="submit"]').first();
  if (await submitBtn.isVisible().catch(() => false)) {
    await submitBtn.click();
  } else {
    await page.keyboard.press("Enter");
  }
}

export async function submitFalabellaLogin(
  page: Page,
  rut: string,
  password: string,
  debugLog: string[],
): Promise<void> {
  if (await openFalabellaLoginDrawer(page, debugLog)) {
    await submitFalabellaDrawerLogin(page, rut, password, debugLog);
    return;
  }

  await submitFalabellaLegacyLogin(page, rut, password, debugLog);
}
