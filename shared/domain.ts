export const purposes = [
  "gaming",
  "office",
  "student",
  "programming",
  "design",
  "portable",
  "budget",
  "high-performance",
] as const;
export type Purpose = (typeof purposes)[number];
export const purposeLabels: Record<Purpose, string> = {
  gaming: "Oyun",
  office: "İş & ofis",
  student: "Öğrenci",
  programming: "Yazılım",
  design: "Tasarım",
  portable: "Taşınabilir",
  budget: "Ekonomik",
  "high-performance": "Yüksek performans",
};
export interface Product {
  id: string;
  brand: string;
  model: string;
  category: string;
  price: number;
  stock: number;
  cpu: string;
  gpu: string;
  ramGb: number;
  storageGb: number;
  screenSize: number;
  refreshRate: number;
  weightKg: number;
  batteryHours: number;
  purposeTags: Purpose[];
  description: string;
  color: string;
}
export interface SearchFilters {
  maxPrice?: number;
  minPrice?: number;
  brands?: string[];
  minRamGb?: number;
  gpuKeyword?: string;
  purpose?: Purpose;
  inStockOnly?: boolean;
}
export interface Cart {
  items: { product: Product; quantity: number; subtotal: number }[];
  total: number;
  itemCount: number;
}
export type ToolName =
  | "search_products"
  | "get_product"
  | "compare_products"
  | "add_to_cart"
  | "get_cart"
  | "remove_from_cart";
export interface ToolTrace {
  name: ToolName;
  arguments: Record<string, unknown>;
  resultCount: number;
}
export interface AssistantReply {
  message: string;
  products: Product[];
  comparison: Product[];
  cart: Cart;
  trace: ToolTrace;
  filters: SearchFilters;
  warning?: string;
}
export interface Health {
  status: string;
  ollama: { available: boolean; modelAvailable: boolean; model: string };
}
export const formatPrice = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
