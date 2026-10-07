import type { ReactNode, Dispatch, SetStateAction } from "react";
import {
  Sparkles,
  SlidersHorizontal,
  LoaderCircle,
  Laptop,
} from "lucide-react";
import type { Product, SearchFilters } from "../shared/domain";
import { purposeLabels, purposes } from "../shared/domain";
export function CatalogPage({
  products,
  loading,
  filters,
  setFilters,
  renderGrid,
  onAssistant,
}: {
  products: Product[];
  loading: boolean;
  filters: SearchFilters;
  setFilters: Dispatch<SetStateAction<SearchFilters>>;
  renderGrid: (p: Product[]) => ReactNode;
  onAssistant: (text?: string) => void;
}) {
  return (
    <>
      {" "}
      <div className="page-heading">
        <div>
          <span className="section-kicker">KÜÇÜK KATALOG, NET SEÇENEKLER</span>
          <h1>
            Sana uyanı keşfet<span>.</span>
          </h1>
          <p>Kurgusal ürünler, gerçek veritabanı. İhtiyacına göre daralt.</p>
        </div>
        <button className="secondary-button" onClick={() => onAssistant()}>
          <Sparkles size={16} /> Asistana sor
        </button>
      </div>
      <section className="filter-bar" aria-label="Ürün filtreleri">
        <span className="filter-label">
          <SlidersHorizontal size={16} />
          Filtrele
        </span>
        <label>
          Üst bütçe
          <input
            type="number"
            min="1"
            max="1000000"
            placeholder="Tüm fiyatlar"
            value={filters.maxPrice ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                maxPrice: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
        </label>
        <label>
          Marka
          <select
            value={filters.brands?.[0] ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                brands: e.target.value ? [e.target.value] : undefined,
              }))
            }
          >
            <option value="">Tüm markalar</option>
            {["Nova", "Artemis", "Tekno", "Atlas", "Luma"].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label>
          RAM
          <select
            value={filters.minRamGb ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                minRamGb: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          >
            <option value="">Tümü</option>
            {[8, 16, 32].map((n) => (
              <option key={n} value={n}>
                {n} GB ve üzeri
              </option>
            ))}
          </select>
        </label>
        <label>
          Kullanım
          <select
            value={filters.purpose ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                purpose:
                  (e.target.value as SearchFilters["purpose"]) || undefined,
              }))
            }
          >
            <option value="">Tümü</option>
            {purposes.map((p) => (
              <option key={p} value={p}>
                {purposeLabels[p]}
              </option>
            ))}
          </select>
        </label>
        <label>
          GPU
          <select
            value={filters.gpuKeyword ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                gpuKeyword: e.target.value || undefined,
              }))
            }
          >
            <option value="">Tümü</option>
            {["RTX", "RTX 4050", "RTX 4060", "RTX 4070", "Intel", "AMD"].map(
              (p) => (
                <option key={p}>{p}</option>
              ),
            )}
          </select>
        </label>
        <label className="stock-filter">
          <input
            type="checkbox"
            checked={filters.inStockOnly ?? false}
            onChange={(e) =>
              setFilters((f) => ({ ...f, inStockOnly: e.target.checked }))
            }
          />
          Yalnızca stokta
        </label>
        <button className="reset-filters" onClick={() => setFilters({})}>
          Sıfırla
        </button>
      </section>
      <div className="results-heading">
        <span>
          <strong>{products.length}</strong> laptop{" "}
          {loading ? "· Güncelleniyor…" : "listeleniyor"}
        </span>
        <span>Fiyat: düşükten yükseğe</span>
      </div>
      {loading ? (
        <div className="loading-state">
          <LoaderCircle className="spin" />
          Ürünler yükleniyor…
        </div>
      ) : products.length ? (
        renderGrid(products)
      ) : (
        <div className="empty-state">
          <Laptop size={38} />
          <h2>Bu filtrelerle bir ürün bulunamadı.</h2>
          <p>Bütçeyi artırabilir veya filtreleri sıfırlayabilirsin.</p>
          <button className="secondary-button" onClick={() => setFilters({})}>
            Filtreleri sıfırla
          </button>
        </div>
      )}{" "}
    </>
  );
}
