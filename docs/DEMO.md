# SepetAI sunum akışı

## Hazırlık

1. `npm run ollama:local` (bu bilgisayardaki taşınabilir kurulum) veya `ollama serve` çalıştırın.
2. `npm run dev` çalıştırın; `http://127.0.0.1:5173` adresini açın.
3. Model durumunun hazır olduğunu kontrol edin. AI asistan sayfasında “Yeni konuşma” simgesine tıklayın.
4. Sepette eski ürün varsa arayüzden çıkarın. Ürünler kurgusaldır; gerçek alışveriş yapılmaz.

## Altı adımlı gösterim

| Adım | Mesaj / işlem | Gösterilecek kanıt |
| --- | --- | --- |
| 1 | `30 bin TL altında oyun için laptop arıyorum.` | `search_products`, bütçe ve `gaming` filtresi |
| 2 | Dönen kartları inceleyin | Katalog kimlikleri, fiyatlar, stoklar SQLite kaydıdır |
| 3 | `En az 16 GB RAM olanları göster.` | Önceki bütçe/kullanım korunur, RAM filtresi eklenir |
| 4 | `İlk iki ürünü karşılaştır.` | Karşılaştırma tablosu gerçek CPU/GPU/RAM/fiyat değerlerini gösterir |
| 5 | `İkincisini sepete ekle.` | İkinci arama sonucu sunucu tarafından çözülür, `add_to_cart` çalışır |
| 6 | “Sepetim” sayfasını açın | Doğru ürün ve fiyat görünür; sayfa yenilendiğinde sepet kalır |

Standart arama sonuçlarında 16 GB filtresinden sonra Game 15 (`p05`, 24.900 TL), Pulse G15 (`p06`, 26.900 TL), Strike 15 (`p07`, 28.900 TL), Play G16 (`p08`, 29.900 TL) beklenir. İkinci ürün Pulse G15'tir. Farklı model filtreleri eklerse dönen sırayı esas alın.

Her yanıttaki “Araç işlemi” alanını açın: araç adı, doğrulanmış argümanlar ve sonuç sayısı görünür. Modelin düşünce zinciri gösterilmez.

## Test kanıtı

```sh
npm test
npm run test:e2e
npm run test:ollama
```

- Normal testler gerçek geçici SQLite veritabanı + sahte LLM sağlayıcısı kullanır. Ollama çalışmadan da geçer.
- `p99` hayali kimliğinin LLM katmanından sepete eklenemediğini gösteren testi açıklayın.
- Stok dışı `Strike Lite` ve negatif/fazla adet talepleri sunucu tarafından reddedilir.
- Canlı Ollama testi gerçek modeli kullanır, demo sepetini değiştirmez.
- Ollama kapalıyken asistan anlaşılır hata verir; ürün arama ve manuel sepet işlemleri çalışır.

## Mimariyi anlatırken

“Model ürün verisinin kaynağı değildir. İsteği yorumlar ve bir araç seçer. Araçlar doğrulanmış argümanlarla gerçek veritabanını kullanır. Model özetin vurgusunu seçer; kullanıcıya sunulan fiyat ve teknik bilgiler sunucu kayıtlarından üretilir.”
