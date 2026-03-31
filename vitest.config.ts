/// <reference types="vitest" />
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@/auth": path.resolve(__dirname, "tests/mocks/auth.ts"),
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/mocks/server-only.ts"),
    },
  },
});
