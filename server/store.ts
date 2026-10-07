import { PrismaClient, type Product as DbProduct } from "@prisma/client";
import type { Cart, Product, SearchFilters } from "../shared/domain.js";
import { AppError } from "./errors.js";
import { productIdSchema, quantitySchema, searchSchema } from "./schemas.js";
export const toProduct = (p: DbProduct): Product => ({
  ...p,
  purposeTags: JSON.parse(p.purposeTags) as Product["purposeTags"],
});
export class Store {
  constructor(public db: PrismaClient) {}
  async search(input: SearchFilters = {}, limit = 30): Promise<Product[]> {
    const filters = searchSchema.parse(input);
    if (
      filters.minPrice !== undefined &&
      filters.maxPrice !== undefined &&
      filters.minPrice > filters.maxPrice
    )
      throw new AppError(
        400,
        "INVALID_RANGE",
        "Alt fiyat üst fiyattan büyük olamaz.",
      );
    const products = await this.db.product.findMany({
      where: {
        category: "laptop",
        price: { gte: filters.minPrice, lte: filters.maxPrice },
        ramGb: { gte: filters.minRamGb },
        ...(filters.brands?.length ? { brand: { in: filters.brands } } : {}),
        ...(filters.gpuKeyword
          ? { gpu: { contains: filters.gpuKeyword } }
          : {}),
        ...(filters.purpose
          ? { purposeTags: { contains: `"${filters.purpose}"` } }
          : {}),
        ...(filters.inStockOnly ? { stock: { gt: 0 } } : {}),
      },
      orderBy: [{ price: "asc" }, { id: "asc" }],
      take: limit,
    });
    return products.map(toProduct);
  }
  async product(id: string): Promise<Product> {
    productIdSchema.parse(id);
    const p = await this.db.product.findUnique({ where: { id } });
    if (!p)
      throw new AppError(
        404,
        "PRODUCT_NOT_FOUND",
        "Bu ürün katalogda bulunamadı.",
      );
    return toProduct(p);
  }
  async compare(ids: string[]) {
    if (new Set(ids).size !== ids.length || ids.length < 2 || ids.length > 4)
      throw new AppError(
        400,
        "INVALID_COMPARISON",
        "Karşılaştırma için 2–4 farklı ürün seçin.",
      );
    return Promise.all(ids.map((id) => this.product(id)));
  }
  async cart(): Promise<Cart> {
    const rows = await this.db.cartItem.findMany({
      where: { userId: "demo" },
      include: { product: true },
      orderBy: { id: "asc" },
    });
    const items = rows.map((row) => ({
      product: toProduct(row.product),
      quantity: row.quantity,
      subtotal: row.quantity * row.product.price,
    }));
    return {
      items,
      total: items.reduce((s, i) => s + i.subtotal, 0),
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
    };
  }
  async changeCart(
    id: string,
    quantity: number,
    mode: "add" | "set" = "add",
  ): Promise<Cart> {
    productIdSchema.parse(id);
    quantitySchema.parse(quantity);
    await this.db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product)
        throw new AppError(
          404,
          "PRODUCT_NOT_FOUND",
          "Bu ürün katalogda bulunamadı.",
        );
      const existing = await tx.cartItem.findUnique({
        where: { userId_productId: { userId: "demo", productId: id } },
      });
      const next =
        mode === "add" ? (existing?.quantity ?? 0) + quantity : quantity;
      if (product.stock === 0)
        throw new AppError(409, "OUT_OF_STOCK", "Bu ürün şu anda stokta yok.");
      if (next > product.stock)
        throw new AppError(
          409,
          "INSUFFICIENT_STOCK",
          `Sepetteki toplam adet stok miktarını (${product.stock}) aşamaz.`,
        );
      await tx.cartItem.upsert({
        where: { userId_productId: { userId: "demo", productId: id } },
        create: { userId: "demo", productId: id, quantity: next },
        update: { quantity: next },
      });
    });
    return this.cart();
  }
  async remove(id: string): Promise<Cart> {
    await this.product(id);
    await this.db.cartItem.deleteMany({
      where: { userId: "demo", productId: id },
    });
    return this.cart();
  }
}
