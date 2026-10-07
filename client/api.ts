import type {
  AssistantReply,
  Cart,
  Health,
  Product,
  SearchFilters,
} from "../shared/domain";
export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
  } catch {
    throw new Error(
      "Sunucuya ulaşılamadı. API sunucusunun çalıştığını kontrol edin.",
    );
  }
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.error?.message ?? "İşlem tamamlanamadı. Yeniden deneyin.",
    );
  return body as T;
}
export const api = {
  products(filters: SearchFilters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined)
        params.set(k, Array.isArray(v) ? v.join(",") : String(v));
    });
    return request<{ products: Product[] }>(`/products?${params}`);
  },
  product: (id: string) => request<{ product: Product }>(`/products/${id}`),
  cart: () => request<Cart>("/cart"),
  health: () => request<Health>("/health"),
  add: (productId: string, quantity = 1) =>
    request<Cart>("/cart/items", {
      method: "POST",
      body: JSON.stringify({ productId, quantity }),
    }),
  quantity: (productId: string, quantity: number) =>
    request<Cart>(`/cart/items/${productId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    }),
  remove: (productId: string) =>
    request<Cart>(`/cart/items/${productId}`, { method: "DELETE" }),
  message: (message: string) =>
    request<AssistantReply>("/assistant/message", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  reset: () =>
    request<{ ok: boolean }>("/assistant/reset", {
      method: "POST",
      body: "{}",
    }),
  compare: (productIds: string[]) =>
    request<{ products: Product[] }>("/products/compare", {
      method: "POST",
      body: JSON.stringify({ productIds }),
    }),
};
