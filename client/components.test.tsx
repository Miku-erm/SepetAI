import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi } from "vitest";
import { ProductCard } from "./ProductCard";
import { Assistant } from "./Assistant";
import { Comparison } from "./Comparison";
import { App } from "./App";
import { api } from "./api";
import type { AssistantReply, Cart, Product } from "../shared/domain";
const product: Product = {
  id: "p06",
  brand: "Artemis",
  model: "Pulse G15",
  category: "laptop",
  price: 26900,
  stock: 9,
  cpu: "Intel Core i5-13420H",
  gpu: "NVIDIA RTX 4050",
  ramGb: 16,
  storageGb: 512,
  screenSize: 15.6,
  refreshRate: 144,
  weightKg: 2.15,
  batteryHours: 6,
  purposeTags: ["gaming"],
  description: "Deterministic laptop",
  color: "sage",
};
const empty: Cart = { items: [], total: 0, itemCount: 0 };
const reply: AssistantReply = {
  message: "Katalogdan bir laptop buldum.",
  products: [product],
  comparison: [],
  cart: empty,
  trace: {
    name: "search_products",
    arguments: { maxPrice: 30000 },
    resultCount: 1,
  },
  filters: { maxPrice: 30000 },
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  history.replaceState({}, "", "/");
});
describe("product and comparison UI", () => {
  it("renders authoritative facts and invokes add with the actual product", async () => {
    const add = vi.fn();
    render(<ProductCard product={product} onAdd={add} onDetails={vi.fn()} />);
    expect(screen.getByText("Pulse G15")).toBeInTheDocument();
    expect(screen.getByText("16 GB RAM")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Artemis Pulse G15 sepete ekle" }),
    );
    expect(add).toHaveBeenCalledWith(product);
  });
  it("disables adding out-of-stock products", () => {
    render(
      <ProductCard
        product={{ ...product, stock: 0 }}
        onAdd={vi.fn()}
        onDetails={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Artemis Pulse G15 sepete ekle" }),
    ).toBeDisabled();
    expect(screen.getByText("Stokta yok")).toBeInTheDocument();
  });
  it("renders comparison facts side by side", () => {
    render(
      <Comparison
        products={[
          product,
          { ...product, id: "p05", model: "Game 15", price: 24900, ramGb: 8 },
        ]}
      />,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("8 GB RAM")).toBeInTheDocument();
    expect(screen.getAllByText("NVIDIA RTX 4050")).toHaveLength(2);
  });
});
describe("assistant UI", () => {
  const props = {
    onCart: vi.fn(),
    onAdd: vi.fn(),
    onDetails: vi.fn(),
    cartBusy: false,
  };
  it("sends Turkish text and renders DB cards and safe tool trace", async () => {
    const mock = vi.spyOn(api, "message").mockResolvedValue(reply);
    render(<Assistant {...props} />);
    await userEvent.type(
      screen.getByRole("textbox", { name: "Asistana mesaj" }),
      "30 bin TL altında oyun laptopu bul.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Mesajı gönder" }),
    );
    await screen.findByText("Katalogdan bir laptop buldum.");
    expect(mock).toHaveBeenCalledWith("30 bin TL altında oyun laptopu bul.");
    expect(screen.getByText("Pulse G15")).toBeInTheDocument();
    expect(screen.getByText("search_products")).toBeInTheDocument();
    expect(props.onCart).toHaveBeenCalledWith(empty);
  });
  it("shows loading and prevents duplicate submits", async () => {
    let resolve!: (r: AssistantReply) => void;
    vi.spyOn(api, "message").mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    render(<Assistant {...props} />);
    await userEvent.type(
      screen.getByRole("textbox", { name: "Asistana mesaj" }),
      "Laptop bul",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Mesajı gönder" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("İsteğin işleniyor");
    expect(
      screen.getByRole("button", { name: "Mesajı gönder" }),
    ).toBeDisabled();
    resolve(reply);
    await screen.findByText(reply.message);
  });
  it("shows Ollama errors and retains the prompt for retry", async () => {
    vi.spyOn(api, "message").mockRejectedValue(
      new Error("Yerel AI modeli şu anda kullanılamıyor."),
    );
    render(<Assistant {...props} />);
    await userEvent.type(
      screen.getByRole("textbox", { name: "Asistana mesaj" }),
      "Laptop bul",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Mesajı gönder" }),
    );
    await screen.findByText("Yerel AI modeli şu anda kullanılamıyor.");
    expect(screen.getByRole("textbox", { name: "Asistana mesaj" })).toHaveValue(
      "Laptop bul",
    );
    expect(screen.getByRole("button", { name: "Mesajı gönder" })).toBeEnabled();
  });
  it("resets the server conversation", async () => {
    vi.spyOn(api, "message").mockResolvedValue(reply);
    const reset = vi.spyOn(api, "reset").mockResolvedValue({ ok: true });
    render(<Assistant {...props} />);
    await userEvent.click(
      screen.getByText("30 bin TL altında oyun için laptop arıyorum."),
    );
    await screen.findByText(reply.message);
    await userEvent.click(screen.getByRole("button", { name: "Yeni konuşma" }));
    await waitFor(() =>
      expect(screen.queryByText(reply.message)).not.toBeInTheDocument(),
    );
    expect(reset).toHaveBeenCalled();
  });
});
describe("integrated store view", () => {
  it("adds a catalog item and shows its server-calculated total in the cart", async () => {
    // jsdom needs browser layout methods; network and business totals are mocked here.
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    HTMLDialogElement.prototype.close = vi.fn();
    HTMLDialogElement.prototype.showModal = vi.fn();
    vi.spyOn(api, "products").mockResolvedValue({ products: [product] });
    vi.spyOn(api, "cart").mockResolvedValue(empty);
    vi.spyOn(api, "health").mockResolvedValue({
      status: "ok",
      ollama: { available: false, modelAvailable: false, model: "qwen3:4b" },
    });
    vi.spyOn(api, "add").mockResolvedValue({
      items: [{ product, quantity: 1, subtotal: 26900 }],
      total: 26900,
      itemCount: 1,
    });
    render(<App />);
    await screen.findByText("Pulse G15");
    await userEvent.click(
      screen.getByRole("button", { name: "Artemis Pulse G15 sepete ekle" }),
    );
    await screen.findByRole("status");
    await userEvent.click(
      screen.getByRole("button", { name: "Sepetim, 1 ürün" }),
    );
    expect(screen.getByText("Güzel bir seçim.")).toBeInTheDocument();
    expect(screen.getAllByText(/26.900/).length).toBeGreaterThan(0);
    expect(api.add).toHaveBeenCalledWith("p06");
  });
});
