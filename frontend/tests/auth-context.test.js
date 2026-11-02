import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearTokens } from "../src/services/api";

// Mock the api module
vi.mock("../src/services/api", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  hasStoredSession: vi.fn(() => false),
}));

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export useAuth hook", async () => {
    const mod = await import("../src/context/AuthContext");
    expect(typeof mod.useAuth).toBe("function");
  });

  it("should export AuthProvider component", async () => {
    const mod = await import("../src/context/AuthContext");
    expect(typeof mod.AuthProvider).toBe("function");
  });
});
