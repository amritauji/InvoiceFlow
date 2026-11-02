import "@testing-library/jest-dom";
import React from "react";

// Make React available globally for JSX transform in test environment
// (Vite's plugin handles this at build time, but vitest/jsdom needs it explicitly)
globalThis.React = React;
