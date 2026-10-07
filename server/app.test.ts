import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { PrismaClient } from "@prisma/client";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { removeTestDirectory } from "../scripts/temp-cleanup.js";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { seedDatabase } from "../prisma/products.js";
import { createApp } from "./app.js";
import { Store } from "./store.js";
import { Agent, newConversation } from "./agent.js";
import type { LLMProvider } from "./llm.js";
import { AppError } from "./errors.js";
import { ordinalReferences } from "./references.js";
let dir: string;
let db: PrismaClient;
let store: Store;
const llm: LLMProvider = {
  decide: vi.fn(),
  summarize: vi.fn(async () => "balanced" as const),
  health: vi.fn(async () => ({
    available: true,
    modelAvailable: true,
    model: "mock",
  })),
};
const app = () => createApp(store, llm, { logger: () => {} });
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "sepet-ai-"));
  db = new PrismaClient({
    datasources: {
      db: { url: `file:${path.join(dir, "test.db").replaceAll("\\", "/")}` },
    },
  });
  store = new Store(db);
  const migration = (await readdir("prisma/migrations")).find((s) =>
    s.endsWith("_init"),
  )!;
  const sql = await readFile(
    `prisma/migrations/${migration}/migration.sql`,
    "utf8",
  );
  for (const statement of sql.split(";").filter((s) => s.trim()))
    await db.$executeRawUnsafe(statement);
  await seedDatabase(db);
});
afterAll(async () => {
  await db.$disconnect();
  await removeTestDirectory(dir);
});
beforeEach(async () => {
  await db.cartItem.deleteMany();
  vi.mocked(llm.decide).mockReset();
  vi.mocked(llm.summarize).mockReset().mockResolvedValue("balanced");
});
describe("database-backed product search", () => {
  it("seeds 24 deterministic products and can reseed without duplication", async () => {
    await seedDatabase(db);
    expect(await db.product.count()).toBe(24);
  });
  it("filters maximum price", async () => {
    const r = await request(app())
      .get("/api/products?maxPrice=30000")
      .expect(200);
    expect(r.body.products.length).toBeGreaterThan(2);
    expect(
      r.body.products.every((p: { price: number }) => p.price <= 30000),
    ).toBe(true);
  });
  it("filters minimum RAM", async () => {
    const products = await store.search({ minRamGb: 32 });
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((p) => p.ramGb >= 32)).toBe(true);
  });
  it("filters purpose using exact tags", async () => {
    const products = await store.search({ purpose: "gaming" });
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((p) => p.purposeTags.includes("gaming"))).toBe(true);
  });
  it("can exclude unavailable products", async () => {
    expect((await store.search()).some((p) => p.stock === 0)).toBe(true);
    expect(
      (await store.search({ inStockOnly: true })).every((p) => p.stock > 0),
    ).toBe(true);
  });
  it("combines brand, GPU, price and RAM filters", async () => {
    const p = await store.search({
      brands: ["Artemis"],
      gpuKeyword: "RTX",
      maxPrice: 30000,
      minRamGb: 16,
    });
    expect(p.map((v) => v.id)).toEqual(["p06"]);
  });
  it("rejects unknown parameters and inverted ranges", async () => {
    await request(app()).get("/api/products?foo=1").expect(400);
    await request(app())
      .get("/api/products?maxPrice=100&minPrice=200")
      .expect(400);
  });
  it("details and comparison use DB values", async () => {
    await request(app()).get("/api/products/p06").expect(200);
    const r = await request(app())
      .post("/api/products/compare")
      .send({ productIds: ["p05", "p06"] })
      .expect(200);
    expect(r.body.products.map((p: { price: number }) => p.price)).toEqual([
      24900, 26900,
    ]);
  });
});
describe("real cart invariants", () => {
  it("adds valid products and calculates exact total", async () => {
    await request(app())
      .post("/api/cart/items")
      .send({ productId: "p05", quantity: 2 })
      .expect(201);
    const r = await request(app())
      .post("/api/cart/items")
      .send({ productId: "p06", quantity: 1 })
      .expect(201);
    expect(r.body.total).toBe(76700);
    expect(r.body.itemCount).toBe(3);
    expect((await store.cart()).total).toBe(76700);
  });
  it("rejects nonexistent DB IDs", async () => {
    await request(app())
      .post("/api/cart/items")
      .send({ productId: "p99", quantity: 1 })
      .expect(404);
    expect((await store.cart()).itemCount).toBe(0);
  });
  it("rejects out-of-stock products", async () => {
    await request(app())
      .post("/api/cart/items")
      .send({ productId: "p09", quantity: 1 })
      .expect(409);
  });
  it("rejects quantity above stock", async () => {
    await request(app())
      .post("/api/cart/items")
      .send({ productId: "p05", quantity: 7 })
      .expect(409);
  });
  it.each([0, -1, 1.5, "2", 101])(
    "rejects invalid quantity %s",
    async (quantity) => {
      await request(app())
        .post("/api/cart/items")
        .send({ productId: "p05", quantity })
        .expect(400);
    },
  );
  it("validates cumulative quantity without partially updating", async () => {
    await store.changeCart("p05", 5);
    await expect(store.changeCart("p05", 2)).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
    });
    expect((await store.cart()).items[0].quantity).toBe(5);
  });
  it("updates quantity and removes items", async () => {
    await store.changeCart("p05", 2);
    const r = await request(app())
      .patch("/api/cart/items/p05")
      .send({ quantity: 1 })
      .expect(200);
    expect(r.body.total).toBe(24900);
    await request(app()).delete("/api/cart/items/p05").expect(200);
    expect((await store.cart()).total).toBe(0);
  });
  it("rejects client supplied prices and malformed JSON", async () => {
    await request(app())
      .post("/api/cart/items")
      .send({ productId: "p05", quantity: 1, price: 1 })
      .expect(400);
    await request(app())
      .post("/api/cart/items")
      .set("Content-Type", "application/json")
      .send("{oops")
      .expect(400);
  });
});
describe("agent tool validation and grounding", () => {
  it.each([
    { name: "invent_products", arguments: {} },
    { name: "add_to_cart", arguments: { productId: "p05", quantity: 0 } },
    { name: "search_products", arguments: { maxPrice: "30000" } },
  ])("rejects malformed or unknown tool requests", async (call) => {
    vi.mocked(llm.decide).mockResolvedValue(call);
    await request(app())
      .post("/api/assistant/message")
      .send({ message: "Laptop bul" })
      .expect(502);
    expect((await store.cart()).itemCount).toBe(0);
  });
  it("an LLM hallucinated product never reaches cart logic", async () => {
    vi.mocked(llm.decide).mockResolvedValue({
      name: "add_to_cart",
      arguments: { productId: "p99", quantity: 1 },
    });
    const spy = vi.spyOn(store, "changeCart");
    await request(app())
      .post("/api/assistant/message")
      .send({ message: "Hayali ürünü sepete ekle" })
      .expect(400);
    expect(spy).not.toHaveBeenCalled();
    expect((await store.cart()).itemCount).toBe(0);
    spy.mockRestore();
  });
  it("DB existence check still rejects an ID even with poisoned known IDs", async () => {
    const ctx = newConversation();
    ctx.knownIds.add("p99");
    vi.mocked(llm.decide).mockResolvedValue({
      name: "add_to_cart",
      arguments: { productId: "p99", quantity: 1 },
    });
    await expect(
      new Agent(store, llm, () => {}).respond("Sepete ekle", ctx),
    ).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
    expect((await store.cart()).total).toBe(0);
  });
  it("runs all six demo steps, merges filters and overrides wrong ordinal IDs", async () => {
    const client = request.agent(app());
    vi.mocked(llm.decide).mockResolvedValueOnce({
      name: "search_products",
      arguments: { maxPrice: 30000, purpose: "gaming", inStockOnly: true },
    });
    const first = await client
      .post("/api/assistant/message")
      .send({ message: "30 bin TL altında oyun için laptop arıyorum." })
      .expect(200);
    expect(
      first.body.products.every(
        (p: { price: number; stock: number }) =>
          p.price <= 30000 && p.stock > 0,
      ),
    ).toBe(true);
    vi.mocked(llm.decide).mockResolvedValueOnce({
      name: "search_products",
      arguments: { minRamGb: 16 },
    });
    const refined = await client
      .post("/api/assistant/message")
      .send({ message: "En az 16 GB RAM olanları göster." })
      .expect(200);
    expect(refined.body.filters).toMatchObject({
      maxPrice: 30000,
      purpose: "gaming",
      minRamGb: 16,
    });
    expect(refined.body.products.map((p: { id: string }) => p.id)).toEqual([
      "p05",
      "p06",
      "p07",
      "p08",
    ]);
    vi.mocked(llm.decide).mockResolvedValueOnce({
      name: "compare_products",
      arguments: { productIndices: [3, 4] },
    });
    const comparison = await client
      .post("/api/assistant/message")
      .send({ message: "İlk iki ürünü karşılaştır." })
      .expect(200);
    expect(comparison.body.comparison.map((p: { id: string }) => p.id)).toEqual(
      ["p05", "p06"],
    );
    vi.mocked(llm.decide).mockResolvedValueOnce({
      name: "add_to_cart",
      arguments: { productId: "p05", quantity: 1 },
    });
    const added = await client
      .post("/api/assistant/message")
      .send({ message: "İkincisini sepete ekle." })
      .expect(200);
    expect(added.body.cart.items[0].product.id).toBe("p06");
    const cart = await client.get("/api/cart").expect(200);
    expect(cart.body.total).toBe(26900);
    vi.mocked(llm.decide).mockResolvedValueOnce({
      name: "get_cart",
      arguments: {},
    });
    await client
      .post("/api/assistant/message")
      .send({ message: "Sepetimi göster" })
      .expect(200);
    vi.mocked(llm.decide).mockResolvedValueOnce({
      name: "get_product",
      arguments: { productIndex: 2 },
    });
    const detail = await client
      .post("/api/assistant/message")
      .send({ message: "İkinci ürünün detayları" })
      .expect(200);
    expect(detail.body.products[0].id).toBe("p06");
    vi.mocked(llm.decide).mockResolvedValueOnce({
      name: "remove_from_cart",
      arguments: { productId: "p06" },
    });
    await client
      .post("/api/assistant/message")
      .send({ message: "İkincisini sepetten çıkar" })
      .expect(200);
    expect((await store.cart()).total).toBe(0);
  });
  it("rejects ordinal references before any recommendation", async () => {
    vi.mocked(llm.decide).mockResolvedValue({
      name: "add_to_cart",
      arguments: { productIndex: 2, quantity: 1 },
    });
    await request(app())
      .post("/api/assistant/message")
      .send({ message: "İkincisini sepete ekle" })
      .expect(400);
  });
  it("keeps the cart action successful if summarization fails", async () => {
    vi.mocked(llm.decide).mockResolvedValue({
      name: "search_products",
      arguments: { maxPrice: 20000 },
    });
    vi.mocked(llm.summarize).mockRejectedValue(new Error("bad summary"));
    const r = await request(app())
      .post("/api/assistant/message")
      .send({ message: "Ucuz laptop bul" })
      .expect(200);
    expect(r.body.warning).toBeTruthy();
    expect(r.body.products.length).toBeGreaterThan(0);
  });
  it("returns safe errors when Ollama is unavailable and remains usable", async () => {
    vi.mocked(llm.decide).mockRejectedValue(
      new AppError(
        503,
        "OLLAMA_UNAVAILABLE",
        "Yerel AI modeli şu anda kullanılamıyor.",
      ),
    );
    const r = await request(app())
      .post("/api/assistant/message")
      .send({ message: "Laptop bul" })
      .expect(503);
    expect(r.body.error.message).not.toContain("stack");
    await request(app()).get("/api/products").expect(200);
  });
  it("resets conversation without erasing the cart", async () => {
    await store.changeCart("p05", 1);
    const client = request.agent(app());
    await client.post("/api/assistant/reset").send({}).expect(200);
    expect((await store.cart()).total).toBe(24900);
  });
  it.each([
    ["İkinciyle üçüncüyü karşılaştır", [2, 3]],
    ["İlk iki ürünü karşılaştır", [1, 2]],
    ["İkincisini sepete ekle", [2]],
    ["1. ürünü göster", [1]],
  ])("resolves Turkish references: %s", (message, expected) => {
    expect(ordinalReferences(message as string)).toEqual(expected);
  });
});
