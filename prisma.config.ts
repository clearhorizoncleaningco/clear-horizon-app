import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 configuration (replaces the `url`/`directUrl` datasource fields that
 * older Prisma versions kept in schema.prisma).
 *
 * The CLI (validate, migrate, db seed) reads the connection URL from here. We
 * point it at DIRECT_URL — the direct (port 5432, non-pooled) Supabase
 * connection — because migrations require a session-level connection that
 * pgbouncer's transaction pooling does not support.
 *
 * We read via `process.env` (with a harmless localhost fallback) rather than
 * Prisma's `env()` helper so that `prisma generate` — which does NOT need a live
 * URL and runs in `postinstall` — never fails on a fresh clone before `.env`
 * exists. `migrate`/`seed` still require a real DIRECT_URL and will error
 * clearly if it is missing.
 *
 * The app at runtime connects separately via the @prisma/adapter-pg driver
 * adapter using DATABASE_URL (the pooled connection). See src/lib/db.ts.
 */
const migrationUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/postgres";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
});
