import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma 7 client singleton.
 *
 * Prisma 7 has no Rust query engine — the client connects through a driver
 * adapter. We use @prisma/adapter-pg over the pooled Supabase connection
 * (DATABASE_URL, pgbouncer). Migrations use the direct connection via
 * prisma.config.ts (DIRECT_URL).
 *
 * Server-only: importing `pg` in a client bundle will fail to compile, which is
 * the desired guard. Never import this module from a Client Component.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill in the Supabase connection string.",
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
