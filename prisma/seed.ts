import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedDatabase, seedProducts } from "./products.js";
const db = new PrismaClient();
try {
  await seedDatabase(db);
  console.log(`${seedProducts.length} deterministic laptops seeded.`);
} finally {
  await db.$disconnect();
}
