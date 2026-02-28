import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // Use Node.js environment for server-side code
    environment: "node",

    // Global setup to inject test env vars before any import
    setupFiles: ["__tests__/setup.ts"],

    // Glob patterns — include unit + integration tests but not e2e
    include: ["__tests__/**/*.test.ts"],
    exclude: ["node_modules", "e2e", ".next"],

    // Timeout generous enough for DB-mocked integration tests
    testTimeout: 15_000,

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
      include: [
        "lib/**/*.ts",
        "schemas/**/*.ts",
        "sockets/handlers/**/*.ts",
        "app/api/**/*.ts",
      ],
      exclude: [
        "lib/env.ts",       // skipped — depends on real process.env parsing
        "**/*.d.ts",
        "**/node_modules/**",
        "**/__tests__/**",
      ],
      // Fail CI if coverage drops below thresholds
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },

  // Resolve TypeScript path aliases (@/ → project root)
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
