import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Resolve the same `@/*` path alias the app uses (tsconfig paths), and stub the
// `server-only` marker so server-only modules (e.g. the GHL client) are
// importable under Vitest's node resolution, which does not set the
// `react-server` export condition. Neither alias affects the Next.js build.
const srcDir = fileURLToPath(new URL("./src/", import.meta.url));
const serverOnlyStub = fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: srcDir },
      { find: /^server-only$/, replacement: serverOnlyStub },
    ],
  },
  test: {
    // Only our own source tests — never the generated Prisma client or deps.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
