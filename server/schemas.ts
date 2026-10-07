import { z } from "zod";
import { purposes } from "../shared/domain.js";
export const productIdSchema = z
  .string()
  .regex(/^p\d{2}$/, "Geçersiz ürün kimliği.");
export const quantitySchema = z.number().int().min(1).max(100);
export const searchSchema = z
  .object({
    maxPrice: z
      .number()
      .int()
      .positive()
      .max(1000000)
      .describe(
        'Maximum price in TL. "30 bin TL altında" means maxPrice:30000, never minPrice.',
      )
      .optional(),
    minPrice: z
      .number()
      .int()
      .nonnegative()
      .max(1000000)
      .describe("Minimum price only if the user requests a lower budget bound.")
      .optional(),
    brands: z.array(z.string().min(1).max(40)).max(10).optional(),
    minRamGb: z
      .number()
      .int()
      .positive()
      .max(128)
      .describe(
        'Minimum RAM in GB, only when requested. "En az 16 GB RAM" means 16.',
      )
      .optional(),
    gpuKeyword: z
      .string()
      .min(1)
      .max(60)
      .describe(
        "Actual GPU hardware substring such as RTX, RTX 4050, GTX, Radeon, Iris. Never usage words like oyun/gaming/student. Omit unless a GPU is explicitly requested.",
      )
      .optional(),
    purpose: z
      .enum(purposes)
      .describe(
        "Usage: oyun => gaming; öğrenci => student; ofis/iş => office; yazılım => programming; tasarım => design; hafif => portable. Gaming is a purpose, not a GPU name.",
      )
      .optional(),
    inStockOnly: z.boolean().optional(),
  })
  .strict();
export const searchToolSchema = searchSchema
  .extend({ resetFilters: z.boolean().optional() })
  .strict();
const reference = z
  .object({
    productId: productIdSchema.optional(),
    productIndex: z.number().int().min(1).max(8).optional(),
  })
  .strict()
  .refine(
    (v) => !!v.productId !== !!v.productIndex,
    "Ürün kimliği veya sıra numarasından birini belirtin.",
  );
const add = z
  .object({
    productId: productIdSchema.optional(),
    productIndex: z.number().int().min(1).max(8).optional(),
    quantity: quantitySchema,
  })
  .strict()
  .refine(
    (v) => !!v.productId !== !!v.productIndex,
    "Tek bir ürün referansı gerekli.",
  );
const compare = z
  .object({
    productIds: z.array(productIdSchema).min(2).max(4).optional(),
    productIndices: z
      .array(z.number().int().min(1).max(8))
      .min(2)
      .max(4)
      .optional(),
  })
  .strict()
  .refine(
    (v) => !!v.productIds !== !!v.productIndices,
    "Kimlikleri veya sıraları belirtin.",
  );
export const toolSchemas = {
  search_products: searchToolSchema,
  get_product: reference,
  compare_products: compare,
  add_to_cart: add,
  get_cart: z.object({}).strict(),
  remove_from_cart: reference,
};
export const toolCallSchema = z.discriminatedUnion("name", [
  z
    .object({ name: z.literal("search_products"), arguments: searchToolSchema })
    .strict(),
  z.object({ name: z.literal("get_product"), arguments: reference }).strict(),
  z
    .object({ name: z.literal("compare_products"), arguments: compare })
    .strict(),
  z.object({ name: z.literal("add_to_cart"), arguments: add }).strict(),
  z
    .object({ name: z.literal("get_cart"), arguments: toolSchemas.get_cart })
    .strict(),
  z
    .object({ name: z.literal("remove_from_cart"), arguments: reference })
    .strict(),
]);
export type ToolCall = z.infer<typeof toolCallSchema>;
export const summarySchema = z
  .object({ focus: z.enum(["price", "ram", "gpu", "portable", "balanced"]) })
  .strict();
export type SummaryFocus = z.infer<typeof summarySchema>["focus"];
