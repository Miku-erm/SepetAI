import { describe, it, expect, vi } from "vitest";
import { OllamaProvider } from "./llm.js";
const config = {
  baseUrl: "http://localhost:11434",
  model: "qwen3:4b",
  timeoutMs: 1000,
  mode: "auto" as const,
};
const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
describe("Ollama adapter", () => {
  it("uses native function calls without exposing model prose", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        message: {
          content: "Invented laptop costs 1 TL",
          tool_calls: [
            {
              function: {
                name: "search_products",
                arguments: { maxPrice: 30000 },
              },
            },
          ],
        },
      }),
    );
    const result = await new OllamaProvider(config, fetcher).decide([
      { role: "user", content: "Laptop bul" },
    ]);
    expect(result).toEqual({
      name: "search_products",
      arguments: { maxPrice: 30000 },
    });
    expect(
      JSON.parse(fetcher.mock.calls[0][1]!.body as string).tools,
    ).toHaveLength(6);
  });
  it("falls back to schema constrained JSON when tools unsupported", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("model does not support tools", { status: 400 }),
      )
      .mockResolvedValueOnce(
        json({
          message: {
            content: JSON.stringify({ name: "get_cart", arguments: {} }),
          },
        }),
      );
    expect(
      await new OllamaProvider(config, fetcher).decide([
        { role: "system", content: "Database facts only." },
        { role: "system", content: "Current cart is empty." },
        { role: "user", content: "Sepetimi göster." },
      ]),
    ).toEqual({
      name: "get_cart",
      arguments: {},
    });
    const body = JSON.parse(fetcher.mock.calls[1][1]!.body as string) as {
      format: unknown;
      messages: { role: string; content: string }[];
    };
    expect(body.format).toBeDefined();
    expect(body.messages.filter((m) => m.role === "system")).toHaveLength(1);
    expect(body.messages[0].content).toContain("Actual GPU hardware substring");
    expect(body.messages.at(-1)).toEqual({
      role: "user",
      content: "Sepetimi göster.",
    });
  });
  it("repairs missing native calls using structured JSON", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: { content: "I found a laptop" } }))
      .mockResolvedValueOnce(
        json({
          message: { content: '{"name":"search_products","arguments":{}}' },
        }),
      );
    expect(await new OllamaProvider(config, fetcher).decide([])).toMatchObject({
      name: "search_products",
    });
  });
  it("rejects multiple operations without executing any", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        message: {
          content: "",
          tool_calls: [
            { function: { name: "get_cart", arguments: {} } },
            { function: { name: "get_cart", arguments: {} } },
          ],
        },
      }),
    );
    await expect(
      new OllamaProvider(config, fetcher).decide([]),
    ).rejects.toMatchObject({ code: "MULTIPLE_TOOLS" });
  });
  it("rejects malformed JSON safely", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ message: { content: "not json" } }));
    await expect(
      new OllamaProvider({ ...config, mode: "json" }, fetcher).decide([]),
    ).rejects.toMatchObject({ code: "MALFORMED_LLM" });
  });
  it("handles connection failure and missing model", async () => {
    await expect(
      new OllamaProvider(
        config,
        vi.fn<typeof fetch>().mockRejectedValue(new Error("ECONNREFUSED")),
      ).decide([]),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      new OllamaProvider(
        config,
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response("model not found", { status: 404 })),
      ).decide([]),
    ).rejects.toMatchObject({ code: "MODEL_UNAVAILABLE" });
  });
  it("summary rejects arbitrary facts and unknown fields", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        message: { content: '{"focus":"gpu","price":1,"product":"fake"}' },
      }),
    );
    await expect(
      new OllamaProvider(config, fetcher).summarize([], { products: [] }),
    ).rejects.toMatchObject({ code: "INVALID_SUMMARY" });
  });
  it("health reports model availability", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ models: [{ name: "qwen3:4b" }] }));
    expect(await new OllamaProvider(config, fetcher).health()).toMatchObject({
      available: true,
      modelAvailable: true,
    });
  });
});
