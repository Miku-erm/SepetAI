import { ArrowUpRight, Plus, Check, Cpu } from "lucide-react";
import type { Product } from "../shared/domain";
import { formatPrice, purposeLabels } from "../shared/domain";
import { LaptopArt } from "./LaptopArt";
export function ProductCard({
  product,
  onAdd,
  onDetails,
  index,
  selected,
  onSelect,
  busy = false,
  compact = false,
}: {
  product: Product;
  onAdd: (p: Product) => void;
  onDetails: (p: Product) => void;
  index?: number;
  selected?: boolean;
  onSelect?: (p: Product) => void;
  busy?: boolean;
  compact?: boolean;
}) {
  return (
    <article className={`product-card ${compact ? "compact" : ""}`}>
      <div className={`product-visual ${product.color}`}>
        <span
          className={`product-tag ${product.stock === 0 ? "unavailable" : ""}`}
        >
          {product.stock === 0
            ? "Stokta yok"
            : purposeLabels[product.purposeTags[0]]}
        </span>
        {index !== undefined && (
          <span className="result-index">{index + 1}</span>
        )}
        <button
          className="art-button"
          aria-label={`${product.brand} ${product.model} detayları`}
          onClick={() => onDetails(product)}
        >
          <LaptopArt color={product.color} />
        </button>
        {onSelect && (
          <button
            className={`compare-select ${selected ? "selected" : ""}`}
            aria-label={`${product.model} karşılaştırma için ${selected ? "kaldır" : "seç"}`}
            aria-pressed={selected}
            onClick={() => onSelect(product)}
          >
            {selected ? <Check size={13} /> : <Plus size={13} />} Karşılaştır
          </button>
        )}
      </div>
      <div className="product-info">
        <div className="brand-row">
          <span>{product.brand}</span>
          <span className={`stock-dot ${product.stock === 0 ? "empty" : ""}`}>
            {product.stock > 0 ? "Stokta" : "Tükendi"}
          </span>
        </div>
        <button className="product-title" onClick={() => onDetails(product)}>
          {product.model}
          <ArrowUpRight size={17} />
        </button>
        <div className="product-spec">
          <Cpu size={13} />
          <span>{product.cpu}</span>
        </div>
        <div className="spec-chips">
          <span>{product.ramGb} GB RAM</span>
          <span>
            {product.storageGb >= 1024
              ? `${product.storageGb / 1024} TB`
              : `${product.storageGb} GB`}{" "}
            SSD
          </span>
        </div>
        <p className="gpu-line">{product.gpu}</p>
        <div className="product-bottom">
          <strong>{formatPrice(product.price)}</strong>
          <button
            className="add-button"
            aria-label={`${product.brand} ${product.model} sepete ekle`}
            disabled={busy || product.stock === 0}
            onClick={() => onAdd(product)}
          >
            <Plus size={17} />
            <span>Sepete ekle</span>
          </button>
        </div>
      </div>
    </article>
  );
}
