import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@knowledge": path.resolve(import.meta.dirname, "knowledge"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
