import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Sparkles,
  RotateCcw,
  ChevronDown,
  ShieldCheck,
  MessageSquare,
  LoaderCircle,
} from "lucide-react";
import type { AssistantReply, Cart, Product } from "../shared/domain";
import { purposeLabels, formatPrice } from "../shared/domain";
import { api } from "./api";
import { ProductCard } from "./ProductCard";
import { Comparison } from "./Comparison";
interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  reply?: AssistantReply;
  error?: boolean;
}
const prompts = [
  "30 bin TL altında oyun için laptop arıyorum.",
  "Öğrenciyim, hafif ve pili iyi bir laptop istiyorum.",
  "Yazılım için en az 32 GB RAM olanları bul.",
];
export function Assistant({
  onCart,
  onAdd,
  onDetails,
  cartBusy,
  initialPrompt,
}: {
  onCart: (cart: Cart) => void;
  onAdd: (p: Product) => void;
  onDetails: (p: Product) => void;
  cartBusy: boolean;
  initialPrompt?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialPrompt ?? "");
  const [busy, setBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const anchor = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const counter = useRef(0);
  useEffect(() => {
    if (initialPrompt) setInput(initialPrompt);
  }, [initialPrompt]);
  useEffect(() => {
    anchor.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages, busy]);
  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setInput("");
    setResetError("");
    setMessages((old) => [
      ...old,
      { id: ++counter.current, role: "user", text },
    ]);
    try {
      const reply = await api.message(text);
      onCart(reply.cart);
      setMessages((old) => [
        ...old,
        {
          id: ++counter.current,
          role: "assistant",
          text: reply.message,
          reply,
        },
      ]);
    } catch (error) {
      setMessages((old) => [
        ...old,
        {
          id: ++counter.current,
          role: "assistant",
          text: error instanceof Error ? error.message : "İstek tamamlanamadı.",
          error: true,
        },
      ]);
      setInput(text);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }
  async function reset() {
    if (busy) return;
    setBusy(true);
    try {
      await api.reset();
      setMessages([]);
      setInput("");
      setResetError("");
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "Konuşma sıfırlanamadı.");
    } finally {
      setBusy(false);
    }
  }
  const latest = [...messages].reverse().find((m) => m.reply)?.reply;
  return (
    <div className="assistant-layout">
      <section className="chat-panel">
        <div className="chat-header">
          <div className="assistant-avatar">
            <Sparkles size={19} />
          </div>
          <div>
            <h2>AI alışveriş asistanı</h2>
            <p>İhtiyacını anlat, birlikte bulalım.</p>
          </div>
          <button
            className="icon-button"
            aria-label="Yeni konuşma"
            onClick={reset}
            disabled={busy}
          >
            <RotateCcw size={17} />
          </button>
        </div>
        <div className="chat-body">
          {messages.length === 0 && (
            <div className="chat-welcome">
              <div className="welcome-spark">
                <Sparkles size={28} />
              </div>
              <span className="eyebrow">MERHABA, BEN SEPETAI</span>
              <h3>
                Yeni laptopun için
                <br />
                nereden başlayalım?
              </h3>
              <p>
                Bütçeni, ne için kullanacağını ve senin için önemli olanları
                söylemen yeterli.
              </p>
              <div className="prompt-list">
                {prompts.map((p) => (
                  <button key={p} onClick={() => send(p)} disabled={busy}>
                    <MessageSquare size={16} />
                    <span>{p}</span>
                    <ArrowUp size={14} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`message ${m.role} ${m.error ? "message-error" : ""}`}
            >
              <span className="message-label">
                {m.role === "user" ? "SEN" : "SEPETAI"}
              </span>
              <p>{m.text}</p>
              {m.error && (
                <span className="error-tip">
                  Mesajın giriş alanında hazır. Bağlantıyı kontrol edip yeniden
                  gönderebilirsin.
                </span>
              )}
              {m.reply?.warning && (
                <p className="inline-warning">{m.reply.warning}</p>
              )}
              {!!m.reply?.products.length && (
                <div className="chat-products">
                  {m.reply.products.map((p, i) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      index={
                        m.reply?.trace.name === "search_products"
                          ? i
                          : undefined
                      }
                      compact
                      onAdd={onAdd}
                      onDetails={onDetails}
                      busy={cartBusy || busy}
                    />
                  ))}
                </div>
              )}
              {!!m.reply?.comparison.length && (
                <Comparison products={m.reply.comparison} />
              )}
              {m.reply && (
                <details className="tool-trace">
                  <summary>
                    <span className="trace-dot" />
                    Araç işlemi <code>{m.reply.trace.name}</code>
                    <ChevronDown size={14} />
                  </summary>
                  <pre>
                    {JSON.stringify(
                      {
                        tool: m.reply.trace.name,
                        arguments: m.reply.trace.arguments,
                        resultCount: m.reply.trace.resultCount,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              )}
            </div>
          ))}
          {busy && (
            <div className="thinking" role="status">
              <LoaderCircle size={17} className="spin" /> İsteğin işleniyor…
            </div>
          )}
          <div ref={anchor} />
        </div>
        <div className="chat-compose">
          {resetError && (
            <p role="alert" className="error-text">
              {resetError}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Asistana mesaj"
              placeholder="Nasıl bir laptop arıyorsun?"
              maxLength={2000}
              rows={2}
              disabled={busy}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send(input);
                }
              }}
            />
            <button aria-label="Mesajı gönder" disabled={busy || !input.trim()}>
              <ArrowUp size={20} />
            </button>
          </form>
          <p>
            <ShieldCheck size={12} /> Ürün bilgileri ve işlemler yerel
            veritabanından doğrulanır.
          </p>
        </div>
      </section>
      <aside className="context-panel">
        <span className="eyebrow">BİRLİKTE DARALTALIM</span>
        <h3>Arama pusulan</h3>
        <p>Her yeni detayda seçeneklerini biraz daha netleştiririz.</p>
        <div className="context-filters">
          {latest && Object.keys(latest.filters).length > 0 ? (
            Object.entries(latest.filters).map(([k, v]) => (
              <div key={k}>
                <span>
                  {
                    (
                      {
                        maxPrice: "Üst bütçe",
                        minPrice: "Alt bütçe",
                        minRamGb: "Minimum RAM",
                        gpuKeyword: "Ekran kartı",
                        purpose: "Kullanım",
                        brands: "Marka",
                        inStockOnly: "Stok",
                      } as Record<string, string>
                    )[k]
                  }
                </span>
                <strong>
                  {k === "maxPrice" || k === "minPrice"
                    ? formatPrice(v as number)
                    : k === "purpose"
                      ? purposeLabels[v as keyof typeof purposeLabels]
                      : k === "minRamGb"
                        ? `${v} GB`
                        : k === "inStockOnly"
                          ? v
                            ? "Stokta olanlar"
                            : "Tüm ürünler"
                          : Array.isArray(v)
                            ? v.join(",")
                            : String(v)}
                </strong>
              </div>
            ))
          ) : (
            <div className="context-empty">
              <span>Henüz bir arama yapmadın.</span>
              <strong>İlk mesajınla başlayalım.</strong>
            </div>
          )}
        </div>
        <div className="followup-card">
          <Sparkles size={20} />
          <h4>Sohbeti devam ettir</h4>
          <p>Önerileri aldıktan sonra sırayla şunları deneyebilirsin:</p>
          {[
            "En az 16 GB RAM olanları göster.",
            "İlk iki ürünü karşılaştır.",
            "İkincisini sepete ekle.",
          ].map((p) => (
            <button
              key={p}
              disabled={busy}
              onClick={() => {
                setInput(p);
                inputRef.current?.focus();
              }}
            >
              {p}
              <ArrowUp size={12} />
            </button>
          ))}
        </div>
        <div className="privacy-note">
          <ShieldCheck size={19} />
          <div>
            <strong>Yerel çalışır. Kontrol sende.</strong>
            <p>
              Sohbet Ollama ile bu bilgisayarda işlenir. Harici ürün servisi
              kullanılmaz.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
