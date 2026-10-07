import express, { type ErrorRequestHandler } from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { z, ZodError } from "zod";
import type { LLMProvider } from "./llm.js";
import { Agent, newConversation, type Conversation } from "./agent.js";
import { AppError } from "./errors.js";
import { productIdSchema, quantitySchema, searchSchema } from "./schemas.js";
import { Store } from "./store.js";
export function createApp(
  store: Store,
  llm: LLMProvider,
  options: { staticDir?: string; logger?: (data: unknown) => void } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  const agent = new Agent(store, llm, options.logger);
  const conversations = new Map<string, Conversation>();
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.get("/api/health", async (_req, res) => {
    await store.db.$queryRaw`SELECT 1`;
    res.json({ status: "ok", ollama: await llm.health() });
  });
  app.get("/api/products", async (req, res) => {
    const query = z
      .object({
        maxPrice: z.coerce.number().int().positive().optional(),
        minPrice: z.coerce.number().int().nonnegative().optional(),
        minRamGb: z.coerce.number().int().positive().optional(),
        brands: z.string().optional(),
        gpuKeyword: z.string().optional(),
        purpose: searchSchema.shape.purpose,
        inStockOnly: z.enum(["true", "false"]).optional(),
      })
      .strict()
      .parse(req.query);
    const { brands, inStockOnly, ...other } = query;
    res.json({
      products: await store.search({
        ...other,
        ...(brands ? { brands: brands.split(",") } : {}),
        ...(inStockOnly ? { inStockOnly: inStockOnly === "true" } : {}),
      }),
    });
  });
  app.get("/api/products/:id", async (req, res) => {
    res.json({
      product: await store.product(productIdSchema.parse(req.params.id)),
    });
  });
  app.post("/api/products/compare", async (req, res) => {
    const input = z
      .object({ productIds: z.array(productIdSchema).min(2).max(4) })
      .strict()
      .parse(req.body);
    res.json({ products: await store.compare(input.productIds) });
  });
  app.get("/api/cart", async (_req, res) => {
    res.json(await store.cart());
  });
  const cartInput = z
    .object({ productId: productIdSchema, quantity: quantitySchema })
    .strict();
  app.post("/api/cart/items", async (req, res) => {
    const input = cartInput.parse(req.body);
    res
      .status(201)
      .json(await store.changeCart(input.productId, input.quantity));
  });
  app.patch("/api/cart/items/:id", async (req, res) => {
    const input = z
      .object({ quantity: quantitySchema })
      .strict()
      .parse(req.body);
    res.json(
      await store.changeCart(
        productIdSchema.parse(req.params.id),
        input.quantity,
        "set",
      ),
    );
  });
  app.delete("/api/cart/items/:id", async (req, res) => {
    res.json(await store.remove(productIdSchema.parse(req.params.id)));
  });
  function conversation(req: express.Request, res: express.Response) {
    const cookie = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("sepet_session="))
      ?.slice(14);
    const id =
      cookie && z.string().uuid().safeParse(cookie).success
        ? cookie
        : randomUUID();
    for (const [key, ctx] of conversations)
      if (!ctx.busy && Date.now() - ctx.touchedAt > 60 * 60 * 1000)
        conversations.delete(key);
    if (!conversations.has(id)) {
      if (conversations.size >= 100)
        throw new AppError(
          503,
          "SESSION_LIMIT",
          "Çok fazla etkin konuşma var. Biraz sonra tekrar deneyin.",
        );
      conversations.set(id, newConversation());
    }
    res.setHeader(
      "Set-Cookie",
      `sepet_session=${id}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=3600`,
    );
    return conversations.get(id)!;
  }
  app.post("/api/assistant/message", async (req, res) => {
    const { message } = z
      .object({ message: z.string().trim().min(1).max(2000) })
      .strict()
      .parse(req.body);
    res.json(await agent.respond(message, conversation(req, res)));
  });
  app.post("/api/assistant/reset", (req, res) => {
    const ctx = conversation(req, res);
    if (ctx.busy)
      throw new AppError(
        409,
        "CONVERSATION_BUSY",
        "Önceki mesaj bitmeden konuşma sıfırlanamaz.",
      );
    Object.assign(ctx, newConversation());
    res.json({ ok: true });
  });
  app.use("/api", (_req, res) => {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "API yolu bulunamadı." } });
  });
  if (options.staticDir) {
    app.use(express.static(options.staticDir));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(options.staticDir!, "index.html"));
    });
  }
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof AppError) {
      res
        .status(error.status)
        .json({ error: { code: error.code, message: error.message } });
      return;
    }
    if (
      error instanceof ZodError ||
      (error instanceof SyntaxError && "body" in error)
    ) {
      res
        .status(400)
        .json({
          error: {
            code: "INVALID_INPUT",
            message:
              "İstek bilgileri geçersiz. Alanları ve miktarı kontrol edin.",
          },
        });
      return;
    }
    console.error("API error", error);
    res
      .status(500)
      .json({
        error: {
          code: "INTERNAL_ERROR",
          message: "İşlem tamamlanamadı. Lütfen yeniden deneyin.",
        },
      });
  };
  app.use(errors);
  return app;
}
