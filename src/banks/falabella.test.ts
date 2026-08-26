import { describe, expect, it } from "vitest";
import {
  FALABELLA_LOGIN_SELECTORS,
  formatFalabellaLoginRut,
  resolveFalabellaLoginSurface,
} from "./falabella-login.js";

describe("formatFalabellaLoginRut", () => {
  it("inserts a dash before the DV when the RUT has no separator", () => {
    expect(formatFalabellaLoginRut("123456789")).toBe("12345678-9");
  });

  it("strips dots and keeps an existing dash", () => {
    expect(formatFalabellaLoginRut("12.345.678-9")).toBe("12345678-9");
  });

  it("keeps K as the DV without forcing lowercase", () => {
    expect(formatFalabellaLoginRut("1234567K")).toBe("1234567-K");
  });

  it("formats a 7-digit body plus DV into 9 characters", () => {
    expect(formatFalabellaLoginRut("1234567-8")).toBe("1234567-8");
  });
});

describe("FALABELLA_LOGIN_SELECTORS", () => {
  it("targets the drawer RUT by id and name, not the loan-calculator placeholder", () => {
    expect(FALABELLA_LOGIN_SELECTORS.rut).toContain("#document");
    expect(FALABELLA_LOGIN_SELECTORS.rut).toContain('input[name="document"]');
    expect(FALABELLA_LOGIN_SELECTORS.rut).not.toContain("placeholder");
    expect(FALABELLA_LOGIN_SELECTORS.loanCalculator).toContain("loanCalculator");
  });

  it("targets the drawer password by id and name", () => {
    expect(FALABELLA_LOGIN_SELECTORS.password).toContain("#pass");
    expect(FALABELLA_LOGIN_SELECTORS.password).toContain('input[name="pass"]');
  });

  it("targets the legacy two-step RUT by id and name, not the drawer document field", () => {
    expect(FALABELLA_LOGIN_SELECTORS.legacyRut).toContain("#rut");
    expect(FALABELLA_LOGIN_SELECTORS.legacyRut).toContain('input[name="rut"]');
    expect(FALABELLA_LOGIN_SELECTORS.legacyRut).not.toContain("#document");
  });
});

describe("resolveFalabellaLoginSurface", () => {
  it("uses the drawer when its RUT is visible", () => {
    expect(resolveFalabellaLoginSurface({ drawerRutVisible: true, legacyRutVisible: false })).toBe("drawer");
  });

  it("prefers the drawer if both RUT fields are visible", () => {
    expect(resolveFalabellaLoginSurface({ drawerRutVisible: true, legacyRutVisible: true })).toBe("drawer");
  });

  it("falls back to the two-step form when only the legacy RUT is visible", () => {
    expect(resolveFalabellaLoginSurface({ drawerRutVisible: false, legacyRutVisible: true })).toBe("legacy");
  });

  it("returns unknown when neither RUT field is visible so the opener can retry", () => {
    expect(resolveFalabellaLoginSurface({ drawerRutVisible: false, legacyRutVisible: false })).toBe("unknown");
  });
});
