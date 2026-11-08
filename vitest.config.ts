import { defineConfig } from "vitest/config";
import path from "node:path";

const repoRoot = path.resolve(__dirname);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(repoRoot, "apps/desktop/src/renderer/src"),
      "@shared": path.join(repoRoot, "apps/desktop/src/shared")
    }
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    passWithNoTests: false,
    coverage: {
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "coverage",
      include: [
        "apps/desktop/src/main/security/**/*.ts",
        "apps/desktop/src/main/workspace/**/*.ts",
        "apps/desktop/src/renderer/src/stores/note-store/**/*.ts"
      ]
    }
  }
});
