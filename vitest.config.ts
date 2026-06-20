import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only our own source tests — never the generated Prisma client or deps.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
