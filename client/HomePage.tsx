import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  LoaderCircle,
  Check,
} from "lucide-react";
import type { Product } from "../shared/domain";
import { LaptopArt } from "./LaptopArt";
export function HomePage({
  products,
  loading,
  renderGrid,
  onAssistant,
  onProducts,
}: {
  products: Product[];
  loading: boolean;
  renderGrid: (p: Product[]) => ReactNode;
  onAssistant: (text?: string) => void;
  onProducts: () => void;
}) {
  return (
    <>
      {" "}
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <span />
            SANA ÖZEL BİR ALIŞVERİŞ DENEYİMİ
          </div>
          <h1>
            Bir laptop değil,
            <br />
            <em>sana uyan laptop.</em>
          </h1>
          <p>
            Onlarca sekme, yüzlerce filtre… Hepsini bırak.
            <br />
            Ne aradığını anlat; birlikte doğru seçimi bulalım.
          </p>
          <button className="primary-button" onClick={() => onAssistant()}>
            <Sparkles size={17} /> Asistanla keşfet <ArrowRight size={18} />
          </button>
          <div className="hero-proof">
            <ShieldCheck size={15} />
            <span>Yerel yapay zekâ. Doğrulanmış ürün bilgileri.</span>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-orbit" />
          <span className="floating-label floating-top">
            <Check size={13} /> Bütçene uygun
          </span>
          <LaptopArt hero color="sage" />
          <span className="floating-label floating-bottom">
            <Sparkles size={14} /> Tam senlik.
          </span>
          <span className="art-caption">
            İYİ BİR SEÇİM, İYİ BİR SOHBETLE BAŞLAR.
          </span>
        </div>
      </section>
      <section className="quick-start">
        <div>
          <span className="section-kicker">NEREDEN BAŞLASAM?</span>
          <h2>Aklında bir şey var mı?</h2>
        </div>
        <div className="quick-prompts">
          {[
            {
              emoji: "↗",
              title: "Oyun için",
              text: "30 bin TL altında oyun için laptop arıyorum.",
            },
            {
              emoji: "⌘",
              title: "İş & yazılım",
              text: "Yazılım için en az 32 GB RAM olan laptopları bul.",
            },
            {
              emoji: "◎",
              title: "Okul & günlük",
              text: "Öğrenciyim, hafif ve pili iyi bir laptop istiyorum.",
            },
          ].map((p) => (
            <button key={p.title} onClick={() => onAssistant(p.text)}>
              <span className="quick-icon">{p.emoji}</span>
              <span>
                {p.title}
                <small>Birlikte keşfedelim</small>
              </span>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </div>
      </section>
      <section className="catalog-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">KATALOGDAN BİRKAÇ SEÇENEK</span>
            <h2>
              Yeni favorin burada olabilir<span>.</span>
            </h2>
          </div>
          <button className="text-link" onClick={onProducts}>
            Tüm laptopları gör <ArrowRight size={16} />
          </button>
        </div>
        {loading ? (
          <div className="loading-state">
            <LoaderCircle className="spin" />
            Katalog yükleniyor…
          </div>
        ) : (
          renderGrid(products.filter((p) => p.stock > 0).slice(0, 4))
        )}
      </section>
      <section className="how-strip">
        <div>
          <span>01</span>
          <strong>İhtiyacını anlat</strong>
          <p>Bütçe, kullanım, beklenti.</p>
        </div>
        <div>
          <span>02</span>
          <strong>Seçeneklerini keşfet</strong>
          <p>Katalogdan doğrulanmış öneriler.</p>
        </div>
        <div>
          <span>03</span>
          <strong>Karşılaştır ve seç</strong>
          <p>İçine sineni sepete ekle.</p>
        </div>
        <span className="how-stamp">
          <ShieldCheck size={27} />
          Kontrol her zaman sende.
        </span>
      </section>{" "}
    </>
  );
}
