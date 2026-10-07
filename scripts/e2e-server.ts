import { PrismaClient } from "@prisma/client";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { removeTestDirectory } from "./temp-cleanup.js";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/app.js";
import { Store } from "../server/store.js";
import { AppError } from "../server/errors.js";
import { seedDatabase } from "../prisma/products.js";
import type { LLMProvider } from "../server/llm.js";
const dir = await mkdtemp(path.join(tmpdir(), "sepet-browser-"));
const db = new PrismaClient({
  datasources: {
    db: { url: `file:${path.join(dir, "e2e.db").replaceAll("\\", "/")}` },
  },
});
const migration = (await readdir("prisma/migrations")).find((s) =>
  s.endsWith("_init"),
)!;
const sql = await readFile(
  `prisma/migrations/${migration}/migration.sql`,
  "utf8",
);
for (const s of sql.split(";").filter((s) => s.trim()))
  await db.$executeRawUnsafe(s);
await seedDatabase(db);
const offline: LLMProvider = {
  async decide() {
    throw new AppError(
      503,
      "OLLAMA_UNAVAILABLE",
      "Yerel AI modeli şu anda kullanılamıyor. Ollama'nın çalıştığından emin olun.",
    );
  },
  async summarize() {
    return "balanced";
  },
  async health() {
    return { available: false, modelAvailable: false, model: "qwen3:4b" };
  },
};
const server = createApp(new Store(db), offline, {
  staticDir: path.resolve("dist/client"),
  logger: () => {},
}).listen(3101, "127.0.0.1");
async function stop() {
  server.close();
  await db.$disconnect();
  await removeTestDirectory(dir);
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
