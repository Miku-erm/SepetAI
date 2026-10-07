import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ToolName } from "../shared/domain.js";
import { AppError } from "./errors.js";
import {
  summarySchema,
  toolCallSchema,
  toolSchemas,
  type SummaryFocus,
} from "./schemas.js";
export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_name?: string;
}
export interface LLMProvider {
  decide(messages: LlmMessage[]): Promise<unknown>;
  summarize(messages: LlmMessage[], result: unknown): Promise<SummaryFocus>;
  health(): Promise<{
    available: boolean;
    modelAvailable: boolean;
    model: string;
  }>;
}
function withSystemInstruction(
  messages: LlmMessage[],
  instruction: string,
): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        messages
          .filter((m) => m.role === "system")
          .map((m) => m.content)
          .join("\n") +
        "\n" +
        instruction,
    },
    ...messages.filter((m) => m.role !== "system"),
  ];
}
const descriptions: Record<ToolName, string> = {
  search_products:
    "Search database laptops. Follow-up filters merge with previous filters. Use resetFilters=true only for a new search or removing old constraints. purpose must be English enum.",
  get_product:
    "Read one previously returned product. productIndex is one-based position in last search.",
  compare_products:
    "Compare 2–4 previously returned products. Use productIndices for ordinal references.",
  add_to_cart:
    "Add quantity of a previously returned product ONLY when the user requests it. Use productIndex for ordinal references.",
  get_cart: "Read current demo cart.",
  remove_from_cart: "Remove a product from cart when requested.",
};
export const tools = Object.entries(toolSchemas).map(([name, schema]) => ({
  type: "function",
  function: {
    name,
    description: descriptions[name as ToolName],
    parameters: zodToJsonSchema(schema, { $refStrategy: "none" }),
  },
}));
const ollamaResponse = z.object({
  message: z.object({
    content: z.string().default(""),
    tool_calls: z
      .array(
        z.object({
          function: z.object({ name: z.string(), arguments: z.unknown() }),
        }),
      )
      .optional(),
  }),
});
export class OllamaProvider implements LLMProvider {
  constructor(
    private config: {
      baseUrl: string;
      model: string;
      timeoutMs: number;
      mode: "auto" | "native" | "json";
    },
    private fetcher: typeof fetch = fetch,
  ) {}
  private async chat(
    body: Record<string, unknown>,
  ): Promise<z.infer<typeof ollamaResponse>> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.config.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          stream: false,
          think: false,
          options: { temperature: 0, num_predict: 1200, num_ctx: 8192 },
          ...body,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch {
      throw new AppError(
        503,
        "OLLAMA_UNAVAILABLE",
        "Yerel AI modeli şu anda kullanılamıyor. Ollama'nın çalıştığından emin olun.",
      );
    }
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      if (response.status === 400 && /tools|tool calling/i.test(detail))
        throw new AppError(
          502,
          "TOOLS_UNSUPPORTED",
          "Modelin araç çağrısı desteği kullanılamıyor.",
        );
      if (response.status === 404)
        throw new AppError(
          503,
          "MODEL_UNAVAILABLE",
          `Yerel model bulunamadı. Terminalde ollama pull ${this.config.model} komutunu çalıştırın.`,
        );
      throw new AppError(
        503,
        "OLLAMA_ERROR",
        "Yerel AI isteği tamamlanamadı. Ollama bağlantısını kontrol edin.",
      );
    }
    try {
      return ollamaResponse.parse(await response.json());
    } catch {
      throw new AppError(
        502,
        "MALFORMED_LLM",
        "Yerel model geçersiz bir yanıt verdi. Yeniden deneyin.",
      );
    }
  }
  async decide(messages: LlmMessage[]): Promise<unknown> {
    if (this.config.mode !== "json") {
      try {
        const response = await this.chat({ messages, tools });
        const calls = response.message.tool_calls;
        if (calls?.length === 1) {
          const call = {
            name: calls[0].function.name,
            arguments: calls[0].function.arguments,
          };
          // Check before falling back. No action has executed at this point.
          if (toolCallSchema.safeParse(call).success) return call;
          if (this.config.mode === "native")
            throw new AppError(
              502,
              "INVALID_TOOL",
              "Model geçersiz araç argümanları üretti.",
            );
        } else if (calls && calls.length > 1) {
          throw new AppError(
            502,
            "MULTIPLE_TOOLS",
            "Lütfen her mesajda tek bir işlem isteyin. Hiçbir işlem yapılmadı.",
          );
        } else if (this.config.mode === "native")
          throw new AppError(
            502,
            "NO_TOOL",
            "Model araç seçemedi. İsteğinizi daha açık yazın.",
          );
      } catch (error) {
        if (
          !(error instanceof AppError) ||
          error.code !== "TOOLS_UNSUPPORTED" ||
          this.config.mode === "native"
        )
          throw error;
      }
    }
    const response = await this.chat({
      messages: withSystemInstruction(
        messages,
        "Return exactly one JSON object: {name, arguments}. No markdown or product facts. Select the tool for the LAST user message, not earlier requests. Only set explicitly requested filters. A comparison must use compare_products; adding must use add_to_cart. Available tools and exact argument definitions:\n" +
          JSON.stringify(tools) +
          '\nExamples of decisions (not products):\n30 bin TL altında oyun laptopu bul => {"name":"search_products","arguments":{"maxPrice":30000,"purpose":"gaming"}}\nEn az 16 GB RAM olsun => {"name":"search_products","arguments":{"minRamGb":16}}\nİlk iki ürünü karşılaştır => {"name":"compare_products","arguments":{"productIndices":[1,2]}}\nİkincisini sepete ekle => {"name":"add_to_cart","arguments":{"productIndex":2,"quantity":1}}',
      ),
      format: zodToJsonSchema(toolCallSchema, { $refStrategy: "none" }),
    });
    try {
      return JSON.parse(response.message.content) as unknown;
    } catch {
      throw new AppError(
        502,
        "MALFORMED_LLM",
        "Modelin yapılandırılmış yanıtı okunamadı. Yeniden deneyin.",
      );
    }
  }
  async summarize(
    messages: LlmMessage[],
    result: unknown,
  ): Promise<SummaryFocus> {
    const response = await this.chat({
      messages: [
        {
          role: "system",
          content:
            'Only summarize the exact backend result below. Select the most useful emphasis for the user: price, ram, gpu, portable, balanced. Output only {"focus":...}; never create facts, prices, IDs or products.',
        },
        {
          role: "user",
          content: JSON.stringify({
            request: [...messages].reverse().find((m) => m.role === "user")
              ?.content,
            result,
          }),
        },
      ],
      format: zodToJsonSchema(summarySchema, { $refStrategy: "none" }),
    });
    try {
      return summarySchema.parse(JSON.parse(response.message.content)).focus;
    } catch {
      throw new AppError(502, "INVALID_SUMMARY", "AI özeti doğrulanamadı.");
    }
  }
  async health() {
    try {
      const response = await this.fetcher(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(2500),
      });
      const body = z
        .object({ models: z.array(z.object({ name: z.string() })) })
        .parse(await response.json());
      return {
        available: response.ok,
        modelAvailable: body.models.some((m) => m.name === this.config.model),
        model: this.config.model,
      };
    } catch {
      return {
        available: false,
        modelAvailable: false,
        model: this.config.model,
      };
    }
  }
}
