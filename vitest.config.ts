import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  },
  // tsconfig uses "jsx": "preserve" for Next's automatic runtime, so components
  // may omit `import React`. Match that here instead of esbuild's classic default.
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react"
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
