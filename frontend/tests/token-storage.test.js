import { describe, it, expect, vi, beforeEach } from "vitest";
import { setTokens, clearTokens, getAccessToken, getRefreshToken, hasStoredSession } from "../src/services/api";

const REFRESH_STORAGE_KEY = "invoiceflow_refresh_token";

describe("Token Storage", () => {
  beforeEach(() => {
    localStorage.clear();
    clearTokens();
  });

  it("should start with null tokens", () => {
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(hasStoredSession()).toBe(false);
  });

  it("should store tokens in memory", () => {
    setTokens("access-123", "refresh-456");
    expect(getAccessToken()).toBe("access-123");
    expect(getRefreshToken()).toBe("refresh-456");
  });

  it("should clear tokens", () => {
    setTokens("access-123", "refresh-456");
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("should keep the access token out of localStorage", () => {
    setTokens("access-123", "refresh-456");
    expect(localStorage.getItem(REFRESH_STORAGE_KEY)).toBe("refresh-456");
    expect(JSON.stringify(localStorage)).not.toContain("access-123");
  });

  it("should persist the refresh token for session restore", () => {
    setTokens("access-123", "refresh-456");
    expect(localStorage.getItem(REFRESH_STORAGE_KEY)).toBe("refresh-456");
    expect(hasStoredSession()).toBe(true);
  });

  it("should remove the persisted refresh token on clear", () => {
    setTokens("access-123", "refresh-456");
    clearTokens();
    expect(localStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull();
  });
});
