# SepetAI

A Turkish conversational laptop store for **Software Implementation and Testing**. Describe a budget and use case, refine the search, compare database products, and add the chosen laptop to a real SQLite cart.

The project brief names Palisade / YC Summer 2026 as inspiration for conversational commerce. This is an independent educational implementation with no affiliation, copied company code, merchant integration, or real checkout. All 24 laptops and their specifications are fictional, deterministic demo records.

## Quick start

Requires **Node.js 22.12+**, npm, and Ollama for AI conversations. Browsing, comparisons, cart operations, builds, and normal tests work without Ollama.

From this folder (`Challenge2`):

```powershell
Copy-Item .env.example .env  # first setup only; retain your existing settings
npm install
npm run db:setup
npm run dev
```

Open **http://127.0.0.1:5173**. The API runs on **http://127.0.0.1:3001**. Vite forwards `/api` to Express. The API and both frontend servers bind to loopback for this single-user demo.

For a production build served entirely by Express:

```sh
npm run build
npm start
```

Open **http://127.0.0.1:3001**. `npm ci` is also supported for installation from the committed lockfile.

Stop the API before reinstalling dependencies or regenerating Prisma on Windows; a running Node process locks Prisma's native DLL. `db:migrate` initializes a missing SQLite file before applying migrations to avoid the Windows schema-engine creation issue.

## Ollama / Qwen3 4B

Install [Ollama](https://ollama.com/download). In a terminal:

```sh
ollama serve
```

In a second terminal:

```sh
ollama pull qwen3:4b
```

On Windows, the Ollama desktop installation may already run the server; in that case only pull the model. Do not launch a second server on the same port.

For **this workspace**, a portable CPU Ollama runtime is available under the ignored `.local/ollama` folder, with models under `.local/models`. Start it after a reboot with:

```sh
npm run ollama:local
```

This local runtime does not install a global command or modify PATH. If a pull is needed, while the server is running use `& .\.local\ollama\ollama.exe pull qwen3:4b` in PowerShell. Portable binaries and model files are local artifacts and are not repository dependencies. A fresh checkout should use the standard Ollama installation above. GPU acceleration requires a normal Ollama installation including GPU libraries; the supplied portable runtime uses CPU.

Configuration in `.env`:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3001` | Express port; if changed, update Vite's proxy too |
| `DATABASE_URL` | `file:./dev.db` | SQLite path relative to `prisma/schema.prisma` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Local inference endpoint |
| `OLLAMA_MODEL` | `qwen3:4b` | Ollama model name |
| `OLLAMA_TIMEOUT_MS` | `120000` | Per-request timeout |
| `OLLAMA_TOOL_MODE` | `json` | `auto`, `native`, or `json` |

No API key or external product API is needed. The UI shows local model availability; assistant failures give a Turkish error and retain the input for retry. Product and cart operations remain usable.

## Architecture

```text
User (Turkish)
       |
React + Vite + TypeScript + Tailwind
       | validated HTTP requests
Express API
       |
Agent Controller ----- Conversation context (server-side, 1-hour TTL)
       |                    last search IDs + filters + 8 recent messages
       +----------------+
       |                |
OllamaProvider       Controlled Tool Layer (Zod)
Qwen3 4B                |
Native calls / JSON   Store business logic
       |                |
Grounded emphasis    Prisma -> SQLite
       |                |
Backend-rendered facts + product cards + actual cart
```

The LLM interprets natural language and chooses a tool. There is no keyword-to-product shortcut or fake chat mode. Turkish ordinal parsing only resolves references **after** the model selects the operation. The model gets exact structured tool results for summarization and chooses an emphasis (`price`, `ram`, `gpu`, `portable`, `balanced`). The backend builds the Turkish summary from database facts; raw generated prose, prices, stock, and product names are never displayed.

Native tool calling follows [Ollama's tool calling API](https://docs.ollama.com/capabilities/tool-calling). The adapter uses Node's built-in `fetch` rather than coupling the domain layer to an SDK. In `auto` mode, unsupported native tools, absent calls, or malformed native arguments fall back once to [schema-constrained JSON](https://docs.ollama.com/capabilities/structured-outputs). The final decision is still strictly validated. Multiple native operations in one message are rejected before executing anything. Connection and model errors are not concealed with fake responses.

**Why JSON is the default:** native tool support was investigated and exercised on Ollama 0.40.0 with Qwen3 4B. Native/automatic runs could complete the demo, but also repeated a search instead of comparing and incurred long CPU generations. The MVP therefore uses the requested robust structured-JSON fallback as its stable default. It is a real LLM decision constrained by the tool schema, followed by strict Zod validation and database execution. Set `OLLAMA_TOOL_MODE=auto` to prefer native calls on another runner, or `native` to exercise native-only behavior.

## Project structure

```text
client/                 React app, pages, chat, comparison, product cards
server/
  app.ts                Validated HTTP API and session cookies
  agent.ts              Context, tool dispatch, result grounding
  llm.ts                LLMProvider abstraction and Ollama adapter
  references.ts         Deterministic Turkish ordinal resolution
  schemas.ts            Shared runtime tool schemas
  store.ts              Database search and cart business rules
shared/domain.ts        Frontend/backend domain types, TRY formatting
prisma/
  schema.prisma         Product and CartItem models
  migrations/           Reproducible initial SQL migration
  products.ts           24 deterministic fictional laptops
  seed.ts               Idempotent seed entry point
scripts/                Live Ollama check, isolated browser test server
e2e/                    Playwright browser scenarios
docs/                   Demo guide, screenshots, verification report
```

## Functionality and API

| Endpoint | Behavior |
| --- | --- |
| `GET /api/health` | Database liveness and Ollama/model availability |
| `GET /api/products` | Sorted catalogue; price, RAM, brand, GPU, purpose, stock filters |
| `GET /api/products/:id` | Current database product details |
| `POST /api/products/compare` | `{ "productIds": ["p05", "p06"] }` |
| `GET /api/cart` | Persisted demo cart with backend totals |
| `POST /api/cart/items` | `{ "productId": "p06", "quantity": 1 }`; additive |
| `PATCH /api/cart/items/:id` | `{ "quantity": 2 }`; absolute quantity |
| `DELETE /api/cart/items/:id` | Remove a cart line |
| `POST /api/assistant/message` | `{ "message": "İkincisini sepete ekle." }` |
| `POST /api/assistant/reset` | Reset conversation, retain cart |

Tools: `search_products`, `get_product`, `compare_products`, `add_to_cart`, `get_cart`, `remove_from_cart`. Product reference tools accept a real `productId` or a one-based `productIndex`; comparisons accept `productIds` or `productIndices`. Assistant searches show up to eight products ordered by price and ID. Subsequent filters merge until the model explicitly sets `resetFilters: true`. Manual catalogue browsing shows all matches.

Assistant recommendations exclude unavailable products by default; tools can explicitly set `inStockOnly: false` when asked to include them. The adapter requests `think: false`, but CPU response times still depend on the Ollama runner and model. The generation budget favors reliable tool selection over aggressive truncation.

Invalid payloads return `400`, missing products `404`, stock/conversation conflicts `409`, malformed model decisions `502`, and unavailable inference `503`. Stack traces are only logged server-side. The collapsible chat panel displays validated tool names, executed arguments, and result counts, never model thinking.

## Anti-hallucination design

1. The system prompt requires tools and forbids invented catalogue facts.
2. Strict Zod schemas reject unknown tools, unknown fields, invalid IDs, bad numbers, and malformed requests.
3. Assistant product actions require IDs already returned in that conversation. Server-side ordinals override incorrect model references to the first/second product.
4. The database independently validates actual existence even after grounding checks. Cart mutations run inside a transaction, checking **existing quantity + requested quantity** against current stock.
5. Product cards, comparisons, prices, stocks, and cart totals come only from database records. The summary model receives those records but can only choose a validated emphasis. An unvalidated free-text summary cannot leak invented products into the interface.

The critical test “an LLM hallucinated product never reaches cart logic” asks a mocked model to add `p99`. The request is rejected and the cart stays empty. A second test poisons known-ID context with `p99` and verifies the database still rejects it. Adapter tests demonstrate that fabricated model prose is discarded and arbitrary summary facts are rejected.

## Tests

Normal tests **do not need Ollama** and use real SQLite in unique temporary folders, seeded from the same migration and product data. They never reset the demo database.

```sh
npm test                 # Vitest, Supertest, React Testing Library
npm run typecheck
npm run build
```

Browser tests use an isolated SQLite database and an explicitly unavailable LLM provider:

```sh
npx playwright install chromium  # once
npm run test:e2e
```

They cover catalogue filtering, details, actual cart addition/quantity/removal, persistence after reload, manual comparison, unavailable-model errors, and a 390px mobile layout. Screenshot artifacts are written to `docs/screenshots/`; failure traces go to ignored `test-results/`.

Live integration, requiring a running Ollama server with the configured model:

```sh
npm run test:ollama
```

This uses a separate temporary SQLite database and sends the actual Turkish demo prompts to Qwen. It asserts catalogue filtering, refinement, comparison order, second-product selection, and the exact persisted cart total. Failures exit with a nonzero status. CPU inference may take longer than GPU inference; adjust the timeout if needed.

For the same live sequence through headless Chromium and the actual Express API, with screenshot evidence and an isolated database:

```sh
npm run test:e2e:ollama
```

## Turkish demo prompts

1. `30 bin TL altında oyun için laptop arıyorum.`
2. `En az 16 GB RAM olanları göster.`
3. `RTX ekran kartı olsun.`
4. `İlk iki ürünü karşılaştır.`
5. `İkincisini sepete ekle.`
6. `Sepetimi göster.`
7. `İkincisini sepetten çıkar.`
8. `Yeni arama: öğrenciyim, hafif ve pili iyi bir laptop istiyorum.`

See [the presentation guide](docs/DEMO.md) and [verification results](docs/VERIFICATION.md).

## Demo Video

The automated demo uses the real production UI, Express tools, a freshly migrated/seeded temporary SQLite database, and **real local qwen3:4b**. It leaves the development cart untouched. No mocked responses are accepted. The recording runs headless and contains no terminals or developer tools.

Prerequisites: installed project dependencies, Playwright Chromium (`npx playwright install chromium`), and FFmpeg **including ffprobe**. Install a build linked from [FFmpeg's download page](https://ffmpeg.org/download.html), add its `bin` folder to PATH, or put the portable binaries in `.local/ffmpeg/bin`. Alternatively set `FFMPEG_PATH` and `FFPROBE_PATH` to their executable paths. No music or narration is added.

Start Ollama in a separate terminal if it is not already running:

```sh
npm run ollama:local
```

The existing `qwen3:4b` model must be available; no other model is downloaded. App services start automatically on an available local port and stop after capture. Each run starts with an empty isolated cart and fresh conversation; the cart is verified again after a page refresh.

```sh
npm run demo:record   # build, check health, record real browser flow
npm run demo:render   # edit an existing successful raw recording
npm run demo:video    # full pipeline
```

Output: `demo/output/SepetAI-demo.mp4` (approximately 58 seconds, 1920×1080, 30 FPS, H.264, no audio). Raw browser footage and measured event times are in `demo/raw/demo.webm` and `demo/raw/timeline.json`. Four inference waits are edited independently: preserve 1.5 seconds after submission and 0.4 seconds before the actual response, cut the inactive middle, and keep typing/results/tools/cart at normal speed. Short waits of at most three seconds are preserved. Only the final stationary cart hold may be extended briefly to meet the target duration.

The render verifies metadata and decodes the whole file, extracts scene frames, generates a real landing-page thumbnail, and writes `demo/output/verification.json`. Inspect the extracted frames before publishing. On failure the command exits nonzero and retains `demo/raw/failure.log`, screenshot evidence, and rendering logs in `demo/temp`. Generated media and local FFmpeg binaries are ignored by git. A full CPU recording can take several minutes even though the edited video lasts one minute.

## MVP boundaries

- One shared demo cart; no authentication, stock reservation, checkout, or payments. Adding to cart does not reduce stock; it validates each line against inventory.
- Conversation context is server memory and expires after one hour or API restart. The SQLite cart survives restarts. Chat UI stays available when navigating between pages, but a full page reload clears its displayed transcript.
- One tool operation per message, up to four products per comparison, and no long-term memory. Unsupported/open-ended conversation is steered toward catalogue discovery.
- Deterministic fictional catalogue; no claims of current market pricing or benchmark performance.
- No scraping, vector database, external merchant integration, or additional LLM providers.
