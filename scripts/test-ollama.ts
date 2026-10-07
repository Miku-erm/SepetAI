import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { removeTestDirectory } from "./temp-cleanup.js";
import { tmpdir } from "node:os";
import path from "node:path";
import { seedDatabase } from "../prisma/products.js";
import { OllamaProvider } from "../server/llm.js";
import { Agent, newConversation } from "../server/agent.js";
import { Store } from "../server/store.js";
const llm = new OllamaProvider({
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  model: process.env.OLLAMA_MODEL ?? "qwen3:4b",
  timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 120000),
  mode: (process.env.OLLAMA_TOOL_MODE ?? "json") as "auto" | "native" | "json",
});
const health = await llm.health();
if (!health.available || !health.modelAvailable) {
  console.error(
    `Ollama/model unavailable. Run: ollama pull ${health.model}, then ollama serve.`,
  );
  process.exit(1);
}
const dir = await mkdtemp(path.join(tmpdir(), "sepet-live-"));
const db = new PrismaClient({
  datasources: {
    db: { url: `file:${path.join(dir, "live.db").replaceAll("\\", "/")}` },
  },
});
try {
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
  const store = new Store(db);
  const agent = new Agent(store, llm);
  const context = newConversation();
  let r = await agent.respond(
    "30 bin TL altında oyun için laptop arıyorum.",
    context,
  );
  assert.equal(r.trace.name, "search_products");
  assert.ok(r.products.length >= 2);
  assert.ok(
    r.products.every(
      (p) => p.price <= 30000 && p.purposeTags.includes("gaming"),
    ),
  );
  r = await agent.respond("En az 16 GB RAM olanları göster.", context);
  assert.equal(r.trace.name, "search_products");
  assert.ok(r.products.length >= 2);
  assert.ok(
    r.products.every(
      (p) =>
        p.ramGb >= 16 && p.price <= 30000 && p.purposeTags.includes("gaming"),
    ),
  );
  const recommended = r.products.map((p) => p.id);
  const second = r.products[1];
  r = await agent.respond("İlk iki ürünü karşılaştır.", context);
  assert.equal(r.trace.name, "compare_products");
  assert.deepEqual(
    r.comparison.map((p) => p.id),
    recommended.slice(0, 2),
  );
  r = await agent.respond("İkincisini sepete ekle.", context);
  assert.equal(r.trace.name, "add_to_cart");
  assert.equal(r.cart.items[0].product.id, second.id);
  assert.equal(r.cart.total, second.price);
  console.info(
    "PASS: live Qwen/Ollama search → refine → compare → add → persisted cart. Demo database was not changed.",
  );
} finally {
  await db.$disconnect();
  await removeTestDirectory(dir);
}
