import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProtectedRoute from "../src/components/ProtectedRoute";

// Mock the auth context
vi.mock("../src/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../src/context/AuthContext";

describe("ProtectedRoute", () => {
  it("should redirect to /login when no user", () => {
    useAuth.mockReturnValue({ user: null });
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    // Should not render children
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("should render children when user exists", () => {
    useAuth.mockReturnValue({ user: { role: "admin" } });
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("should redirect when role not in allowedRoles", () => {
    useAuth.mockReturnValue({ user: { role: "department_user" } });
    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={["admin"]}>
          <div>Admin Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
  });

  it("should render when role is in allowedRoles", () => {
    useAuth.mockReturnValue({ user: { role: "admin" } });
    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={["admin", "manager"]}>
          <div>Admin Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByText("Admin Content")).toBeInTheDocument();
  });
});
