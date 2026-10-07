import { HomePage } from "./HomePage";
import { CatalogPage } from "./CatalogPage";
import { CartPage } from "./CartPage";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  LayoutGrid,
  ShoppingBag,
  Home,
  ChevronRight,
  ShieldCheck,
  X,
  Check,
  Plus,
  Menu,
  GitCompareArrows,
} from "lucide-react";
import type { Cart, Health, Product, SearchFilters } from "../shared/domain";
import { formatPrice } from "../shared/domain";
import { api } from "./api";
import { LaptopArt } from "./LaptopArt";
import { ProductCard } from "./ProductCard";
import { Assistant } from "./Assistant";
import { Comparison } from "./Comparison";
type Page = "home" | "products" | "assistant" | "cart";
const titles: Record<Page, string> = {
  home: "Keşfet",
  products: "Tüm laptoplar",
  assistant: "AI asistan",
  cart: "Sepetim",
};
const emptyCart: Cart = { items: [], total: 0, itemCount: 0 };
function currentPage(): Page {
  const p = location.pathname.slice(1);
  return ["products", "assistant", "cart"].includes(p) ? (p as Page) : "home";
}
export function App() {
  const [page, setPage] = useState<Page>(currentPage);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [health, setHealth] = useState<Health>();
  const [filters, setFilters] = useState<SearchFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [cartBusy, setCartBusy] = useState(false);
  const [detail, setDetail] = useState<Product>();
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<Product[]>();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [prompt, setPrompt] = useState("");
  const requestSequence = useRef(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const listener = () => setPage(currentPage());
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  useEffect(() => {
    void api
      .cart()
      .then(setCart)
      .catch((e) => setError(e.message));
    let active = true;
    const refreshHealth = () => {
      void api
        .health()
        .then((result) => {
          if (active) setHealth(result);
        })
        .catch(() => {});
    };
    refreshHealth();
    const timer = setInterval(refreshHealth, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const id = ++requestSequence.current;
    setLoading(true);
    void api
      .products(filters)
      .then((r) => {
        if (id === requestSequence.current) {
          setProducts(r.products);
          setError("");
        }
      })
      .catch((e) => {
        if (id === requestSequence.current) setError(e.message);
      })
      .finally(() => {
        if (id === requestSequence.current) setLoading(false);
      });
  }, [filters]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (detail || comparison) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [detail, comparison]);
  function navigate(next: Page) {
    setPage(next);
    history.pushState({}, "", next === "home" ? "/" : `/${next}`);
    setMobileMenu(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function add(p: Product) {
    if (cartBusy) return;
    setCartBusy(true);
    try {
      setCart(await api.add(p.id));
      setToast(`${p.brand} ${p.model} sepete eklendi.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sepet güncellenemedi.");
    } finally {
      setCartBusy(false);
    }
  }
  async function mutateCart(id: string, quantity?: number) {
    if (cartBusy) return;
    setCartBusy(true);
    try {
      setCart(
        quantity === undefined
          ? await api.remove(id)
          : await api.quantity(id, quantity),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sepet güncellenemedi.");
    } finally {
      setCartBusy(false);
    }
  }
  async function showDetails(p: Product) {
    try {
      setDetail((await api.product(p.id)).product);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ürün açılamadı.");
    }
  }
  function select(p: Product) {
    setSelected((ids) =>
      ids.includes(p.id)
        ? ids.filter((id) => id !== p.id)
        : ids.length < 4
          ? [...ids, p.id]
          : ids,
    );
  }
  async function compare() {
    try {
      setComparison((await api.compare(selected)).products);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Karşılaştırma açılamadı.");
    }
  }
  function startAssistant(text = "") {
    setPrompt(text);
    navigate("assistant");
  }
  const modelReady = health?.ollama.available && health.ollama.modelAvailable;
  const productGrid = (items: Product[]) => (
    <div className="product-grid">
      {items.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          onAdd={add}
          onDetails={showDetails}
          busy={cartBusy}
          onSelect={select}
          selected={selected.includes(p.id)}
        />
      ))}
    </div>
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <button
          className="logo"
          onClick={() => navigate("home")}
          aria-label="SepetAI ana sayfa"
        >
          <span className="logo-symbol">
            <ShoppingBag size={21} />
            <span />
          </span>
          <span>
            sepet<span className="logo-ai">AI</span>
            <span className="logo-period">.</span>
          </span>
        </button>
        <div className="nav-label">ALIŞVERİŞİN YENİ YOLU</div>
        <nav>
          {(
            [
              { id: "home", icon: Home },
              { id: "products", icon: LayoutGrid },
              { id: "assistant", icon: Sparkles },
              { id: "cart", icon: ShoppingBag },
            ] as const
          ).map((n) => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? "active" : ""}`}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={18} />
              {titles[n.id]}
              {n.id === "assistant" && <span className="small-ai">AI</span>}
              {n.id === "cart" && cart.itemCount > 0 && (
                <span className="cart-count">{cart.itemCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-tip">
          <span className="tip-icon">
            <Sparkles size={18} />
          </span>
          <h3>
            Filtreler yerine,
            <br />
            bir sohbet.
          </h3>
          <p>
            Ne aradığını anlat.
            <br />
            Gerisini birlikte halledelim.
          </p>
          <button onClick={() => startAssistant()}>
            Asistanı dene <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="local-model">
          <span className={`connection-dot ${modelReady ? "connected" : ""}`} />
          <div>
            <strong>{health?.ollama.model ?? "qwen3:4b"}</strong>
            <span>
              {modelReady
                ? "Yerel model hazır"
                : health
                  ? "Model bağlantısı yok"
                  : "Bağlantı kontrol ediliyor"}
            </span>
          </div>
          <ShieldCheck size={16} />
        </div>
        <div className="sidebar-footer">
          Software Implementation & Testing
          <br />
          Üniversite projesi · 2026
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Menüyü aç"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Menu size={21} />
            </button>
            <span>Mağaza</span>
            <ChevronRight size={13} />
            <strong>{titles[page]}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-label">DEMO MAĞAZA</span>
            <button
              className="header-cart"
              aria-label={`Sepetim, ${cart.itemCount} ürün`}
              onClick={() => navigate("cart")}
            >
              <ShoppingBag size={18} />
              <span>{cart.itemCount}</span>
            </button>
            <span className="avatar">D</span>
          </div>
        </header>
        <main
          className={
            page === "assistant"
              ? "page-content assistant-page"
              : "page-content"
          }
        >
          {error && (
            <div role="alert" className="error-banner">
              <span>{error}</span>
              <button aria-label="Hatayı kapat" onClick={() => setError("")}>
                <X size={17} />
              </button>
            </div>
          )}
          {page === "home" && (
            <HomePage
              products={products}
              loading={loading}
              renderGrid={productGrid}
              onAssistant={startAssistant}
              onProducts={() => {
                setFilters({});
                navigate("products");
              }}
            />
          )}
          {page === "products" && (
            <CatalogPage
              products={products}
              loading={loading}
              filters={filters}
              setFilters={setFilters}
              renderGrid={productGrid}
              onAssistant={startAssistant}
            />
          )}
          <section hidden={page !== "assistant"}>
            <div className="page-heading">
              <div>
                <span className="section-kicker">
                  ALIŞVERİŞİ BİR SOHBETE DÖNÜŞTÜR
                </span>
                <h1>
                  Birlikte doğru seçimi bulalım<span>.</span>
                </h1>
              </div>
              <span className={`model-badge ${modelReady ? "ready" : ""}`}>
                <span className="connection-dot" />
                {modelReady
                  ? "Yerel AI hazır"
                  : "Ollama bağlantısını kontrol edin"}
              </span>
            </div>
            <Assistant
              onCart={setCart}
              onAdd={add}
              onDetails={showDetails}
              cartBusy={cartBusy}
              initialPrompt={prompt}
            />
          </section>
          {page === "cart" && (
            <CartPage
              cart={cart}
              cartBusy={cartBusy}
              onAssistant={startAssistant}
              onProducts={() => navigate("products")}
              onDetails={showDetails}
              onChange={mutateCart}
            />
          )}
          <footer className="main-footer">
            <span>
              sepetAI. <span>Akıllı seçimler, sade alışveriş.</span>
            </span>
            <span>24 kurgusal laptop · Yerel demo</span>
          </footer>
        </main>
      </div>
      {selected.length > 0 && page !== "assistant" && page !== "cart" && (
        <div className="compare-bar">
          <GitCompareArrows size={18} />
          <span>{selected.length}/4 ürün seçildi</span>
          <button onClick={() => setSelected([])} className="text-link">
            Temizle
          </button>
          <button
            className="primary-button"
            disabled={selected.length < 2}
            onClick={compare}
          >
            Karşılaştır <ArrowRight size={15} />
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button onClick={() => navigate("cart")}>
            Sepete git <ArrowRight size={14} />
          </button>
        </div>
      )}
      <dialog
        ref={dialogRef}
        className="details-dialog"
        onCancel={() => {
          setDetail(undefined);
          setComparison(undefined);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setDetail(undefined);
            setComparison(undefined);
          }
        }}
      >
        <div className="dialog-inner">
          <button
            className="dialog-close icon-button"
            aria-label="Detayları kapat"
            onClick={() => {
              setDetail(undefined);
              setComparison(undefined);
            }}
          >
            <X size={22} />
          </button>
          {detail && (
            <div className="detail-layout">
              <div className={`detail-art ${detail.color}`}>
                <LaptopArt color={detail.color} />
                <span>Kurgusal ürün görselleştirmesi</span>
              </div>
              <div>
                <span className="section-kicker">
                  {detail.brand} · {detail.id}
                </span>
                <h2>{detail.model}</h2>
                <p>{detail.description}</p>
                <dl>
                  {[
                    ["İşlemci", detail.cpu],
                    ["GPU", detail.gpu],
                    ["Bellek", `${detail.ramGb} GB`],
                    ["SSD", `${detail.storageGb} GB`],
                    [
                      "Ekran",
                      `${detail.screenSize}″ / ${detail.refreshRate} Hz`,
                    ],
                    ["Ağırlık", `${detail.weightKg} kg`],
                    ["Tahmini pil", `${detail.batteryHours} saat`],
                    ["Stok", `${detail.stock} adet`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="detail-bottom">
                  <strong>{formatPrice(detail.price)}</strong>
                  <button
                    className="primary-button"
                    onClick={() => add(detail)}
                    disabled={cartBusy || detail.stock === 0}
                  >
                    <Plus size={17} />
                    {detail.stock ? "Sepete ekle" : "Stokta yok"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {comparison && <Comparison products={comparison} />}
        </div>
      </dialog>
    </div>
  );
}
