import { PrismaClient } from "@prisma/client";

// Standard Next.js pattern: reuse one client across hot-reloads in dev
// instead of opening a new database connection on every file change.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
