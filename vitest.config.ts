import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    server: { deps: { inline: ["convex-test"] } },
    projects: [
      { extends: true, test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
      { extends: true, test: { name: "convex", include: ["tests/convex/**/*.test.ts"], environment: "edge-runtime" } },
    ],
  },
});
