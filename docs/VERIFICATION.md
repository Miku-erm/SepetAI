# Verification record

Date: **7 October 2026**, Europe/Istanbul. Workspace: `Challenge2`.

## Automated demo video

`npm run demo:video` completed successfully using the real local **qwen3:4b**, existing production React/Express code, controlled tools and a newly migrated/seeded isolated SQLite database. No application UI or business logic was changed for filming. The four actual requests returned `search_products`, `search_products`, `compare_products`, and `add_to_cart`. The search narrowed from five to four products; comparison used the first two current results; the second product was added through the server. The persisted cart was verified after a browser refresh: Artemis Pulse G15, quantity 1, **26,900 TL**.

- Final artifact: `demo/output/SepetAI-demo.mp4`.
- Verified with ffprobe: **58.166667 seconds**, **1920×1080**, **30/1 FPS**, **H.264**, MP4, no audio; 4,352,535 bytes.
- Raw real browser recording: 161.48 seconds. Four inactive inference sections were cut, removing 107.09 seconds. Each retains 1.5 seconds after submission and 0.4 seconds before the real response. Results, typing, comparison, tool traces and cart remain at normal speed.
- No frozen-frame padding was needed for this render. Intro and outro graphics contain only editorial titles.
- The entire MP4 was decoded with FFmpeg `-xerror`; no decode errors. Intro, initial/refined results, comparison, add-to-cart, cart, outro, first/last frames and the Turkish font fixture were visually inspected. Product facts and tool arguments are readable; no horizontal overflow, terminal, developer tools, error screen or black tail appears in those frames.
- `npm test`: **50 passed**. `npm run test:e2e`: **4 passed**, including its TypeScript checks and production build. The new video scripts are included in TypeScript checks.
- FFmpeg 9.0.2 essentials was installed only under ignored `.local/ffmpeg`, from a Windows build linked by ffmpeg.org; its ZIP SHA256 matched the publisher's checksum. The pipeline also supports binaries on PATH or explicit executable paths.

CPU inference remains slow during raw capture; the final edit removes that waiting. Generated video, raw evidence, timeline, thumbnail, extracted frames and verification JSON are ignored by git and can be regenerated with the documented commands.

## Verified deterministic checks

| Check | Result |
| --- | --- |
| `npm install` and Prisma generation with API stopped | Passed |
| `npm run db:setup` on a newly created SQLite database | Passed: migration + 24 products |
| Repeat migration/seed on the demo database | Passed: idempotent |
| TypeScript checking | Passed, frontend and backend |
| Production build | Passed, React assets and Express JavaScript |
| Vitest / Supertest / React Testing Library | **50 tests passed** |
| Isolated Playwright browser suite | **4 tests passed** |
| Full dependency audit | **0 vulnerabilities** |
| Production HTTP `/assistant` and `/api/health` | HTTP 200; model available |
| Desktop and 390px mobile screenshots | Inspected; no horizontal overflow |
| Invalid IDs, stock, cumulative quantity, cart totals | Passed automated tests |
| Unknown tools / malformed arguments / fabricated facts | Rejected by automated tests |
| Unavailable Ollama | Turkish error; API/UI remain usable |

## Test coverage

Backend tests use a real, isolated SQLite database populated with the checked-in migration and seed. They cover max price, minimum RAM, purpose, brand/GPU combinations, stock exclusions, comparisons, exact cart totals, bad/nonexistent IDs, stock failures, invalid quantities, cumulative quantities, updates/removal, strict HTTP payloads, malformed JSON, tool validation, server-side ordinal resolution, search refinement, cart tools, reset, and inference errors.

Grounding tests demonstrate two distinct boundaries: a hallucinated model ID cannot reach cart logic, and a nonexistent ID is still rejected by the database when inserted into known-ID context. Provider tests cover native calls, structured JSON fallback/repair, multiple-call rejection, malformed JSON, missing model, network failure, and arbitrary summary-fact rejection.

Frontend tests cover real product facts, disabled out-of-stock actions, comparison rendering, Turkish message submission, backend product cards, tool trace, loading, retry after model failure, reset, and reflecting a backend cart response.

Browser tests cover the built app, real Express routes, and real SQLite transactions: filtering, details, adding, changing quantity, persistence after reload, removing, comparing, unavailable-model UI, mobile navigation and overflow. Their LLM provider is deliberately unavailable, so normal browser tests do not depend on Ollama.

## Live model verification

The portable **Ollama 0.40.0** runtime and **qwen3:4b** (4.0B, Q4_K_M) model are available locally. Inference uses CPU.

`npm run test:ollama` passed the actual Turkish search → refine → compare → add-to-cart sequence. It selected `p06` (Artemis Pulse G15) as the second refined product, persisted one unit in the isolated database, and verified the exact **26,900 TL** total. The demo database was not changed.

`npm run test:e2e:ollama` **passed** the complete browser → Express → Qwen3 → controlled tools → SQLite flow in the default **validated JSON mode**. The first search returned five in-stock gaming laptops within 30,000 TL. The RAM refinement preserved the price and purpose and returned four laptops. The comparison displayed `p05` and `p06`; “İkincisini sepete ekle” added one `p06`. The cart page displayed **26,900 TL**. No browser JavaScript errors were observed.

After restarting Ollama with `npm run ollama:local`, `npm run test:ollama` passed again with the default JSON configuration. The portable runtime and downloaded model survive process restarts. The demo cart remains empty after all integration checks.

Native/automatic mode is implemented and covered by adapter tests. Actual native model choices were inconsistent in this installed runner, so structured JSON is the documented default. The model receives exact tool definitions and parameter descriptions; schemas constrain its output and Zod validates it again. The latest user message is preserved as the final message, with one consolidated system prompt.

**Acceptance verdict:** all critical MVP criteria in the project brief are satisfied under the documented default configuration. There are no critical TODOs in the demo path.

## Artifacts

- [Desktop landing page](screenshots/home-desktop.png)
- [Mobile landing page](screenshots/home-mobile.png)
- [Unavailable-model assistant](screenshots/assistant-offline.png)
- [Live comparison and cart action](screenshots/assistant-live.png)
- [Live cart with validated total](screenshots/cart-live.png)

## Known MVP limitations

One demo user and shared persistent cart; conversation memory expires or resets with the API; displayed messages clear on a full page reload. One tool per message. Fictional laptop catalogue. No payment, order fulfilment, stock reservation, authentication, scraping, or external merchant API. The portable runtime is CPU-only; a normal Ollama installation supplies GPU support.
