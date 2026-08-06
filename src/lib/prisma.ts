import { PrismaClient } from "@prisma/client";
import { assertDbUrlMatchesProvider } from "@/lib/db-config";

// Guard fail-fast: pastikan DATABASE_URL cocok dengan DB_PROVIDER sebelum konek.
assertDbUrlMatchesProvider();

// Singleton Prisma client (hindari koneksi berlebih saat hot-reload dev).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
