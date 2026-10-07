import { chromium, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { mkdtemp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { type Server } from "node:http";
import { createApp } from "../../server/app.js";
import { Store } from "../../server/store.js";
import { OllamaProvider } from "../../server/llm.js";
import { seedDatabase } from "../../prisma/products.js";
import { removeTestDirectory } from "../temp-cleanup.js";
import type { AssistantReply, Cart } from "../../shared/domain.js";
import { binary, directories, probe, raw, type Timeline } from "./common.js";

await directories();
await binary("ffmpeg");
await binary("ffprobe");
const model = "qwen3:4b";
const llm = new OllamaProvider({
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434", model,
  timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 120000),
  mode: (process.env.OLLAMA_TOOL_MODE ?? "json") as "auto" | "native" | "json",
});
const health = await llm.health();
if (!health.available || !health.modelAvailable)
  throw new Error("Real qwen3:4b unavailable. Start npm run ollama:local; ensure qwen3:4b has been pulled. No mocked recording will be created.");
const dir = await mkdtemp(path.join(tmpdir(), "sepet-demo-"));
const db = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "demo.db").replaceAll("\\", "/")}` } } });
let server: Server | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let page: Page | undefined;
let origin = 0;
const timeline: Timeline = {
  version: 1, success: false, model, realModel: true, startedAt: new Date().toISOString(),
  recordingElapsed: 0, videoOffset: 0, rawDuration: 0, scenes: [], requests: [], cart: null,
};
const now = () => (performance.now() - origin) / 1000;
const hold = (seconds: number) => new Promise<void>((resolve) => setTimeout(resolve, seconds * 1000));
let sceneStart = 0;
function finishScene(name: string, inspect: number) {
  timeline.scenes.push({ name, start: sceneStart, end: now(), inspect });
  sceneStart = now();
}
async function noOverflow() {
  expect(await page!.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function frame(name: string) {
  await noOverflow();
  await page!.screenshot({ path: path.join(raw, `${name}.png`) });
  return now();
}
async function align(selector: string) {
  await page!.locator(".message.assistant").last().locator(selector).evaluate((element) => {
    const body = element.closest(".chat-body")!;
    body.scrollTo({ top: body.scrollTop + element.getBoundingClientRect().top - body.getBoundingClientRect().top - 20, behavior: "smooth" });
  });
  await hold(0.55); // Deliberate on-screen scroll/presentation beat, never an inference wait.
}
async function send(name: string, prompt: string, tool: string, ordinal: number) {
  console.info(`Recording ${name}: ${prompt}`);
  const input = page!.getByRole("textbox", { name: "Asistana mesaj" });
  await input.click();
  await input.pressSequentially(prompt, { delay: 24 });
  await hold(0.45);
  const responsePromise = page!.waitForResponse((r) => r.url().endsWith("/api/assistant/message") && r.request().method() === "POST", { timeout: 250000 });
  const submitted = now();
  await page!.getByRole("button", { name: "Mesajı gönder" }).click();
  await expect(page!.locator(".thinking")).toBeVisible();
  const response = await responsePromise;
  const reply = await response.json() as AssistantReply;
  if (!response.ok()) throw new Error(`${name}: real API failed: ${JSON.stringify(reply)}`);
  await expect(page!.locator(".message.assistant")).toHaveCount(ordinal);
  await expect(page!.locator(".thinking")).toHaveCount(0);
  await expect(page!.locator(".message.assistant").last().locator(".tool-trace code")).toHaveText(tool);
  expect(reply.warning).toBeUndefined();
  const appeared = now();
  timeline.requests.push({ name, prompt, submitted, response: appeared, tool: reply.trace.name,
    arguments: reply.trace.arguments, resultCount: reply.trace.resultCount,
    productIds: reply.products.map(p => p.id), comparisonIds: reply.comparison.map(p => p.id) });
  console.info(`${name}: real ${tool}, ${(appeared - submitted).toFixed(1)}s`);
  await hold(0.7); // Let the existing app's response scroll settle.
  return reply;
}
async function trace(seconds: number) {
  const details = page!.locator(".message.assistant").last().locator(".tool-trace");
  await details.locator("summary").click();
  await align(".tool-trace");
  await expect(details.locator("pre")).toBeVisible();
  await hold(seconds);
}
try {
  const migration = (await readdir("prisma/migrations")).find(s => s.endsWith("_init"));
  if (!migration) throw new Error("Initial database migration missing");
  const sql = await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8");
  for (const statement of sql.split(";").filter(s => s.trim())) await db.$executeRawUnsafe(statement);
  await seedDatabase(db);
  const store = new Store(db);
  expect((await store.cart()).itemCount).toBe(0);
  await mkdir(path.join(raw, "browser"), { recursive: true });
  server = createApp(store, llm, { staticDir: path.resolve("dist/client"), logger: () => {} }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Demo server did not start");
  const baseURL = `http://127.0.0.1:${address.port}`;
  const apiHealth = await fetch(`${baseURL}/api/health`).then(r => r.json());
  if (apiHealth.status !== "ok" || !apiHealth.ollama.modelAvailable) throw new Error("Demo health check failed");
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: path.join(raw, "browser"), size: { width: 1600, height: 900 } } });
  page = await context.newPage();
  origin = performance.now();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(baseURL);
  await expect(page.getByRole("heading", { name: "Bir laptop değil, sana uyan laptop." })).toBeVisible();
  await expect(page.getByText("Yerel model hazır")).toBeVisible();
  sceneStart = now(); // Drop startup and the initial blank browser frame.
  const introFrame = await frame("intro");
  await hold(4);
  finishScene("intro", introFrame);
  await page.getByRole("button", { name: "AI asistan AI", exact: true }).click();
  await expect(page.getByText("Yerel AI hazır")).toBeVisible();
  await page.getByRole("button", { name: "Yeni konuşma" }).click();
  await expect(page.getByRole("textbox", { name: "Asistana mesaj" })).toBeEnabled();
  await hold(1.6);
  finishScene("assistant", now() - 0.6);
  const search = await send("search", "30 bin TL altında oyun için laptop arıyorum.", "search_products", 1);
  expect(search.products.length).toBeGreaterThanOrEqual(2);
  expect(search.products.every(p => p.price <= 30000 && p.stock > 0 && p.purposeTags.includes("gaming"))).toBe(true);
  await align(".chat-products");
  const searchFrame = await frame("search");
  await hold(3.6);
  await trace(2.4);
  finishScene("search", searchFrame + 1);
  const refined = await send("refine", "En az 16 GB RAM olanları göster.", "search_products", 2);
  expect(refined.filters.maxPrice).toBe(search.filters.maxPrice);
  expect(refined.products.length).toBeGreaterThanOrEqual(2);
  expect(refined.products.length).toBeLessThan(search.products.length);
  expect(refined.products.every(p => p.ramGb >= 16 && p.price <= 30000 && p.stock > 0 && p.purposeTags.includes("gaming"))).toBe(true);
  await align(".chat-products");
  const refineFrame = await frame("refine");
  await hold(3.5);
  await trace(1.5);
  finishScene("refine", refineFrame + 1);
  const comparison = await send("compare", "İlk iki ürünü karşılaştır.", "compare_products", 3);
  expect(comparison.comparison.map(p => p.id)).toEqual(refined.products.slice(0, 2).map(p => p.id));
  await align(".comparison-table");
  await expect(page.getByRole("table")).toBeVisible();
  const compareFrame = await frame("compare");
  await hold(5.5);
  await trace(1.5);
  finishScene("compare", compareFrame + 1);
  const added = await send("add", "İkincisini sepete ekle.", "add_to_cart", 4);
  expect(added.cart.itemCount).toBe(1);
  expect(added.cart.items[0].product.id).toBe(refined.products[1].id);
  expect(added.cart.total).toBe(refined.products[1].price);
  await hold(1.3);
  await trace(3);
  const addFrame = await frame("add");
  finishScene("add", addFrame - 1);
  await page.getByRole("button", { name: "Sepetim, 1 ürün" }).click();
  await expect(page.locator(".cart-product .product-title")).toHaveText(refined.products[1].model);
  const cartFrame = await frame("cart");
  await hold(2);
  await page.reload();
  await expect(page.locator(".cart-product .product-title")).toHaveText(refined.products[1].model);
  const persisted = await context.request.get(`${baseURL}/api/cart`);
  const cart = await persisted.json() as Cart;
  expect(cart).toEqual(added.cart);
  timeline.cart = cart;
  await hold(3.3);
  finishScene("cart", cartFrame + 1);
  expect(errors).toEqual([]);
  await noOverflow();
  timeline.recordingElapsed = now();
  const video = page.video()!;
  await context.close();
  await video.saveAs(path.join(raw, "demo.webm"));
  const metadata = await probe(path.join(raw, "demo.webm"));
  timeline.rawDuration = Number(metadata.format.duration);
  // Playwright's first captured frame can precede newPage() resolution. Align clocks
  // using the complete video duration; a few-frame closure uncertainty is covered
  // by the 0.4s loading lead-in retained before every real response.
  timeline.videoOffset = timeline.rawDuration - timeline.recordingElapsed;
  if (Math.abs(timeline.videoOffset) > 1) throw new Error(`Unexpected recording clock offset: ${timeline.videoOffset}s`);
  timeline.success = true;
  await writeFile(path.join(raw, "timeline.json"), JSON.stringify(timeline, null, 2));
  console.info(`PASS: real Qwen3 recording ${timeline.rawDuration.toFixed(1)}s; clean isolated cart, actual persisted state.`);
} catch (error) {
  await writeFile(path.join(raw, "failure.log"), String(error));
  await writeFile(path.join(raw, "timeline.json"), JSON.stringify(timeline, null, 2));
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(raw, "failure.png") }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  await db.$disconnect();
  await removeTestDirectory(dir);
}
