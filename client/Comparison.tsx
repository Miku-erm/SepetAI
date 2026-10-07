import type { Product } from "../shared/domain";
import { formatPrice } from "../shared/domain";
const rows: { label: string; value: (p: Product) => string }[] = [
  { label: "Fiyat", value: (p) => formatPrice(p.price) },
  { label: "İşlemci", value: (p) => p.cpu },
  { label: "Ekran kartı", value: (p) => p.gpu },
  { label: "Bellek", value: (p) => `${p.ramGb} GB RAM` },
  { label: "Depolama", value: (p) => `${p.storageGb} GB SSD` },
  { label: "Ekran", value: (p) => `${p.screenSize}″ · ${p.refreshRate} Hz` },
  { label: "Ağırlık", value: (p) => `${p.weightKg} kg` },
  { label: "Tahmini pil", value: (p) => `${p.batteryHours} saat` },
  { label: "Stok", value: (p) => `${p.stock} adet` },
];
export function Comparison({ products }: { products: Product[] }) {
  return (
    <div className="comparison-scroll">
      <table className="comparison-table">
        <caption>Ürün karşılaştırması · katalog verileri</caption>
        <thead>
          <tr>
            <th>Özellik</th>
            {products.map((p) => (
              <th key={p.id}>
                {p.brand}
                <br />
                {p.model}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th>{r.label}</th>
              {products.map((p) => (
                <td key={p.id}>{r.value(p)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
