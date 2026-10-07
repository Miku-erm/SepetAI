import "dotenv/config";
import { chromium, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { mkdtemp, readdir, readFile, mkdir } from "node:fs/promises";
import { removeTestDirectory } from "./temp-cleanup.js";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/app.js";
import { Store } from "../server/store.js";
import { OllamaProvider } from "../server/llm.js";
import { seedDatabase } from "../prisma/products.js";
import type { AssistantReply } from "../shared/domain.js";
const dir = await mkdtemp(path.join(tmpdir(), "sepet-live-browser-"));
const db = new PrismaClient({
  datasources: {
    db: { url: `file:${path.join(dir, "live.db").replaceAll("\\", "/")}` },
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
const llm = new OllamaProvider({
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  model: process.env.OLLAMA_MODEL ?? "qwen3:4b",
  timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 120000),
  mode: (process.env.OLLAMA_TOOL_MODE ?? "json") as "auto" | "native" | "json",
});
const server = createApp(new Store(db), llm, {
  staticDir: path.resolve("dist/client"),
}).listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
if (!address || typeof address === "string")
  throw new Error("Missing test port");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${address.port}/assistant`);
  await expect(page.getByText("Yerel AI hazır")).toBeVisible();
  async function send(text: string, tool: string, ordinal: number) {
    console.info("Browser prompt:", text);
    await page.getByRole("textbox", { name: "Asistana mesaj" }).fill(text);
    const pendingResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/assistant/message") &&
        response.request().method() === "POST",
      { timeout: 250000 },
    );
    await page.getByRole("button", { name: "Mesajı gönder" }).click();
    const response = await pendingResponse;
    expect(response.status()).toBe(200);
    const reply = (await response.json()) as AssistantReply;
    await expect(page.locator(".message.assistant")).toHaveCount(ordinal, {
      timeout: 250000,
    });
    await expect(
      page.locator(".message.assistant").last().locator(".tool-trace code"),
    ).toHaveText(tool);
    return reply;
  }
  const first = await send(
    "30 bin TL altında oyun için laptop arıyorum.",
    "search_products",
    1,
  );
  expect(first.filters.maxPrice).toBeLessThanOrEqual(30000);
  expect(first.products.length).toBeGreaterThanOrEqual(2);
  expect(
    first.products.every(
      (p) =>
        p.price <= 30000 && p.stock > 0 && p.purposeTags.includes("gaming"),
    ),
  ).toBe(true);
  const second = await send(
    "En az 16 GB RAM olanları göster.",
    "search_products",
    2,
  );
  expect(
    second.products.every(
      (p) =>
        p.price <= 30000 && p.ramGb >= 16 && p.purposeTags.includes("gaming"),
    ),
  ).toBe(true);
  const refined = page.locator(".message.assistant").last();
  await expect(refined.locator(".product-card")).toHaveCount(4);
  await send("İlk iki ürünü karşılaştır.", "compare_products", 3);
  await expect(page.getByRole("table")).toBeVisible();
  await send("İkincisini sepete ekle.", "add_to_cart", 4);
  await page
    .locator(".message.assistant")
    .last()
    .locator(".tool-trace summary")
    .click();
  await page.locator(".chat-body").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/assistant-live.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Sepetim, 1 ürün" }).click();
  await expect(page.locator(".cart-product .product-title")).toHaveText(
    "Pulse G15",
  );
  await expect(page.locator(".cart-total")).toContainText("26.900");
  await page.screenshot({
    path: "docs/screenshots/cart-live.png",
    fullPage: true,
    animations: "disabled",
  });
  if (errors.length) throw new Error(errors.join("; "));
  console.info(
    "PASS: complete live browser → Express → Qwen3 → tools → SQLite → persisted cart demo.",
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.$disconnect();
  await removeTestDirectory(dir);
}
