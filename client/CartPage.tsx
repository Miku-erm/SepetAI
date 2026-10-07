import {
  ArrowRight,
  Sparkles,
  ShoppingBag,
  ShieldCheck,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import type { Cart, Product } from "../shared/domain";
import { formatPrice } from "../shared/domain";
import { LaptopArt } from "./LaptopArt";
export function CartPage({
  cart,
  cartBusy,
  onAssistant,
  onProducts,
  onDetails,
  onChange,
}: {
  cart: Cart;
  cartBusy: boolean;
  onAssistant: (text?: string) => void;
  onProducts: () => void;
  onDetails: (p: Product) => void;
  onChange: (id: string, quantity?: number) => void;
}) {
  return (
    <>
      {" "}
      <div className="page-heading">
        <div>
          <span className="section-kicker">SEÇTİĞİN LAPTOPLAR</span>
          <h1>
            Sepetim<span>.</span>
          </h1>
          <p>{cart.itemCount} ürün · Fiyatlar katalogdan hesaplanır.</p>
        </div>
        <button className="text-link" onClick={onProducts}>
          Alışverişe devam et <ArrowRight size={16} />
        </button>
      </div>
      {cart.items.length ? (
        <div className="cart-layout">
          <section className="cart-items">
            {cart.items.map(({ product: p, quantity, subtotal }) => (
              <article className="cart-row" key={p.id}>
                <div className={`cart-art ${p.color}`}>
                  <LaptopArt color={p.color} />
                </div>
                <div className="cart-product">
                  <span className="section-kicker">{p.brand}</span>
                  <button
                    className="product-title"
                    onClick={() => onDetails(p)}
                  >
                    {p.model}
                  </button>
                  <p>
                    {p.ramGb} GB RAM · {p.storageGb} GB SSD
                  </p>
                  <span>{formatPrice(p.price)} / adet</span>
                  <div className="quantity-control">
                    <button
                      aria-label={`${p.model} adedi azalt`}
                      onClick={() => onChange(p.id, quantity - 1)}
                      disabled={cartBusy || quantity <= 1}
                    >
                      <Minus size={14} />
                    </button>
                    <strong>{quantity}</strong>
                    <button
                      aria-label={`${p.model} adedi artır`}
                      onClick={() => onChange(p.id, quantity + 1)}
                      disabled={cartBusy || quantity >= p.stock}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <div className="cart-row-right">
                  <strong>{formatPrice(subtotal)}</strong>
                  <button
                    className="icon-button"
                    aria-label={`${p.model} sepetten çıkar`}
                    onClick={() => onChange(p.id)}
                    disabled={cartBusy}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            ))}
          </section>
          <aside className="cart-summary">
            <span className="section-kicker">SEPET ÖZETİ</span>
            <h2>Güzel bir seçim.</h2>
            <div>
              <span>Ürünler ({cart.itemCount})</span>
              <strong>{formatPrice(cart.total)}</strong>
            </div>
            <div className="cart-total">
              <span>Toplam</span>
              <strong>{formatPrice(cart.total)}</strong>
            </div>
            <p>
              <ShieldCheck size={16} />
              Bu bir demo mağazadır. Ödeme ve sipariş işlemi yapılmaz; sepetin
              yerel veritabanında saklanır.
            </p>
          </aside>
        </div>
      ) : (
        <div className="empty-state">
          <ShoppingBag size={42} />
          <h2>Yeni favorine yer açtık.</h2>
          <p>Sepetin henüz boş. Asistanla sana uyan laptopu bulalım.</p>
          <button className="primary-button" onClick={() => onAssistant()}>
            <Sparkles size={17} /> Asistanla keşfet
          </button>
        </div>
      )}{" "}
    </>
  );
}
