import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { z } from "zod";
import { createApp } from "./app.js";
import { OllamaProvider } from "./llm.js";
import { Store } from "./store.js";
const env = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
    OLLAMA_MODEL: z.string().default("qwen3:4b"),
    OLLAMA_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(300000)
      .default(120000),
    OLLAMA_TOOL_MODE: z.enum(["auto", "native", "json"]).default("json"),
  })
  .parse(process.env);
const db = new PrismaClient();
const llm = new OllamaProvider({
  baseUrl: env.OLLAMA_BASE_URL,
  model: env.OLLAMA_MODEL,
  timeoutMs: env.OLLAMA_TIMEOUT_MS,
  mode: env.OLLAMA_TOOL_MODE,
});
const app = createApp(new Store(db), llm, {
  staticDir: path.resolve("dist/client"),
});
await db.$connect();
const server = app.listen(env.PORT, "127.0.0.1", () => {
  console.info(`SepetAI API: http://127.0.0.1:${env.PORT}`);
});
async function shutdown() {
  server.close();
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
