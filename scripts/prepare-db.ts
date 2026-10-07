import "dotenv/config";
import { PrismaClient } from "@prisma/client";
// Prisma's Windows schema engine may fail to create a missing SQLite file.
// The query engine reliably initializes it; migrations remain authoritative.
const db = new PrismaClient();
try {
  await db.$queryRaw`SELECT 1`;
} finally {
  await db.$disconnect();
}
