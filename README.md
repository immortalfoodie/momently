# Momently

Momently: your AI event director. From a vague idea to a plan that survives real life.

## Chosen Vertical

**Celebration & Event Planner** for milestone weddings, birthdays, anniversaries, and community festivals.

The user is an everyday host in India planning a personal celebration—someone who knows the feeling they want, the guest count, and their maximum budget, but lacks professional event planning expertise. Indian celebrations carry unique logistical complexity: multi-event day-of schedules, extended family headcount surges, strict cultural dietary requirements (such as Jain, vegan, and pure vegetarian options), monsoon weather volatility, and three-tier city vendor rate disparities. 

The host communicates naturally in conversational English, Hindi, or Hinglish, while Momently provides the mathematical rigor, logistical constraints, and vendor coordination required to bring the vision to life.

## What It Does

Momently transforms unstructured celebration ideas into complete, mathematically sound event plans that adapt to real-world friction.

| Requirement | Feature | Page | Main Source File |
|---|---|---|---|
| **Budgets** | Hard cap enforcement, tier pricing, zero-sum funding trade-offs, lockable line items | `/events/[id]/budget` | [`src/engine/budget.ts`](src/engine/budget.ts) |
| **Timelines** | Run-of-show sequence, transition buffers, delay recovery, live phone-first tracker | `/events/[id]/timeline`, `/events/[id]/day-of` | [`src/engine/schedule.ts`](src/engine/schedule.ts) |
| **Vendor Checklists** | Urgency-based task grouping, quote comparison, shareable vendor briefs | `/events/[id]/checklist`, `/events/[id]/vendors` | [`src/engine/taskDates.ts`](src/engine/taskDates.ts) |
| **Personalised Ideas** | Vibe-to-Vision intake, 3 distinct aesthetic concepts, Chaos Lab stress testing | `/new`, `/events/[id]/concepts`, `/events/[id]/chaos` | [`src/engine/planFactory.ts`](src/engine/planFactory.ts) |

### Page-by-Page Feature Tour
- **`/new` (Vibe-to-Vision Intake)**: Conversational story intake converting natural descriptions into bound starter plans.
- **`/events/[id]` (Overview)**: Central status dashboard presenting key facts, budget health, schedule progress, and top risks.
- **`/events/[id]/concepts` (Concept Studio)**: Side-by-side comparison of 3 aesthetic directions with tailored vendor tiers and color palettes.
- **`/events/[id]/budget` (Budget Guardian)**: Interactive line-item table, lock controls, zero-sum funding trade-offs, and forgotten cost suggestions.
- **`/events/[id]/timeline` (Timeline)**: Run-of-show builder with buffer controls, gap alerts, and schedule shifting.
- **`/events/[id]/checklist` (Checklist)**: Due-date categorized task manager (months out, weeks out, week of, day of).
- **`/events/[id]/guests` (Guests)**: Headcount scaling, dietary requirements (Jain, vegan, vegetarian), and dining table seating calculator.
- **`/events/[id]/vendors` (Vendors)**: Quote comparison tracker and sanitized vendor brief generator.
- **`/events/[id]/chaos` (Chaos Lab)**: Stress-test lab simulating rain, budget cuts, guest surges, and vendor cancellations.
- **`/events/[id]/day-of` (Event Day)**: Calm, phone-first coordinator with live now/next tracking and delay buffer absorption.
- **`/events/[id]/kit` & `/kit/plan` (Event Kit)**: Local export center for printable plans, CSV spreadsheets, and ICS calendars.

For full architectural blueprints and invariants, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Approach and Logic

Momently is built upon a fundamental architectural separation of concerns: **the AI proposes, a deterministic engine decides**.

```text
Host UI  ─────────────────>  Local Zustand Store  ──>  Pure Engine (Calculates, Validates, Applies)
   │                                                             ▲
   └─> API Route ──> Server-Only LLM ──> Zod Validation ──> Proposed Patch (Diffs + User Approval Gate)
```

### Why Money and Constraints Never Come from the LLM
Large Language Models excel at narrative comprehension, cultural nuance, and aesthetic ideation, but frequently hallucinate arithmetic, misquote standard prices, and violate strict boundaries. In Momently, the LLM is prohibited from computing prices, modifying budget totals, or altering schedule minutes directly. 

All financial calculations, guest scaling multipliers, and schedule validations are computed exclusively by a pure, deterministic engine using verified Indian rate cards across three city tiers:
- **Tier 1**: Mumbai, Delhi NCR, Bengaluru (metro benchmark pricing)
- **Tier 2**: Pune, Jaipur, Ahmedabad, Chandigarh, Hyderabad, Chennai, Kolkata
- **Tier 3**: Rest of India (regional value pricing)

### The Approval Gate and Versioned Plan
The AI operates in an advisory capacity and has no write permissions on the event plan. When the assistant suggests an adjustment—such as upgrading floral arrangements or booking a rain contingency hall—the server constructs a typed patch operation (`PlanPatchOp`) wrapped inside a previewable `RecoveryOption`. 

The user inspects exact price, item, and timeline diffs before clicking "Approve". Only user approval commits changes through store reducers, monotonically incrementing the plan version. The engine supports 18 atomic patch operations:
- **Line Items & Budget**: `add_item` (adds a new item with price and category), `update_item` (modifies price or quantity), `remove_item` (deletes an item), `lock_item` (protects item from auto-edits), `set_cap` (adjusts total ceiling), `apply_savings` (lowers flexible items).
- **Schedule**: `add_slot` (inserts a run-of-show session), `update_slot` (changes start minute or duration), `remove_slot` (removes a session), `shift_schedule` (translates multiple slots forward or backward), `absorb_delay` (compresses flexible sessions to recover time).
- **Checklist Tasks**: `add_task` (creates a dated task), `update_task` (updates text or due days), `remove_task` (deletes a task), `set_task_status` (marks todo, in-progress, or done).
- **Guests & Vendors**: `set_guest_needs` (updates dietary and accessibility counts), `update_vendor_need` (changes category status), `upsert_vendor_quote` (records or replaces vendor bid), `remove_vendor_quote` (clears a quote).

### Budget Guardian, Chaos Lab, and Chaos Score
- **Budget Guardian**: Intercepts any proposed change or user edit that would exceed the hard budget cap. Rather than simply blocking the host, it computes non-destructive funding options (stepping down flexible, unlocked line items) while strictly protecting locked categories.
- **Chaos Lab**: Stress-tests plans against four realistic disruptions: monsoon rain, budget cuts, guest surges, and sudden vendor cancellations.
- **Chaos Score**: A transparent, deterministic sum of rule-based penalty points evaluated directly from the plan, grouped into four risk severity bands:
  - *Calm* (0–24): High contingency resilience, healthy transition slack, low vulnerability.
  - *Manageable* (25–49): Minor gaps such as missing vendor quotes or tight schedule buffers.
  - *Exposed* (50–74): Notable exposure such as unconfirmed primary vendors or tight contingency margins.
  - *Fragile* (75–100): Critical exposure (e.g., outdoor venue in monsoon without shelter).
  The score is a fully explainable vulnerability index, not an opaque probabilistic prediction.

## How the Solution Works

The user journey proceeds across 6 cohesive steps matching the interactive demo tour:

1. **Vibe-to-Vision Intake**: The host enters an unstructured celebration narrative in English, Hindi, or Hinglish (e.g., *"Parents' 25th anniversary in Mumbai, ₹1.5 lakh budget, 80 guests, old Bollywood vibe"*).
   - *Why it matters*: Converts ambiguous stories into structured constraints, city tier pricing, and tailored starter concepts.
   - *What to inspect*: The ₹1.5 lakh hard cap, 80 guests, Mumbai tier-1 rates, and 3 concepts initialize automatically.
2. **Pick the Vintage Bollywood Concept**: The host reviews three distinct concepts generated from their story and selects Vintage Bollywood.
   - *Why it matters*: Translates aesthetic preferences into concrete rate-card quality tiers without manual arithmetic.
   - *What to inspect*: The assistant proposes a concept patch with exact line-item diffs that waits for your approval click.
3. **Upgrade Decor with Budget Guardian**: The host upgrades a core item (such as premium stage decor).
   - *Why it matters*: Prevents over-cap commits by generating zero-sum funding trade-offs across flexible categories while protecting locked items.
   - *What to inspect*: The funding options step down flexible items while strictly protecting the upgraded decor family.
4. **Increase Guests from 80 to 110**: The host increases guest count from 80 to 110.
   - *Why it matters*: A living celebration plan scales catering, seating tables, and contingency reserves dynamically.
   - *What to inspect*: Compare holding the ₹1.5 lakh cap through rebalancing against raising the cap.
5. **What If It Rains? (Chaos Lab)**: The host tests a monsoon rain scenario.
   - *Why it matters*: Stress-testing weather risk before contracts are signed turns potential panic into a pre-priced recovery plan.
   - *What to inspect*: The Chaos Score reduction across canopy cover and standby indoor backup hall recovery options.
6. **The Event Kit & Final Checklist**: The host reviews the synchronized execution checklist and export center.
   - *Why it matters*: Every approved decision, contingency task, and vendor requirement flows into an actionable checklist and offline exports.
   - *What to inspect*: Prioritized task windows (months out, weeks out, week of, day of), offline CSV/ICS exports, and printable run-sheets.

## Run It

### Prerequisites
- Node.js 20 or higher
- npm 10 or higher

### Setup and Start
```bash
npm install
npm run dev
```
Open `http://localhost:3000` in your browser. Click **Watch the demo** on the home page to launch the interactive, guided walkthrough.

### Demo Mode vs Live Mode
- **Demo Mode (default)**: Operates instantly out of the box with zero configuration and zero API keys. Built-in rule-based responses in [`src/llm/mock/`](src/llm/mock) simulate full Gemini responses deterministically.
- **Live Mode**: Connects to Google Gemini via the official `@google/genai` SDK. Copy `.env.example` to `.env.local` (never commit real credentials):
  ```bash
  cp .env.example .env.local
  ```
  Configure your `.env.local`:
  ```env
  GEMINI_API_KEY=your_gemini_api_key_here
  GEMINI_MODEL=gemini-2.5-flash
  AI_PROVIDER=gemini
  ```
  Set `GEMINI_MODEL` to a supported Gemini model (e.g., `gemini-2.5-flash`).

## Evaluation Criteria Alignment

| Parameter | Verifiable Implementation Points | Reference Files |
|---|---|---|
| **Code Quality** | Strict TypeScript throughout with zero `any` types and zero `console.log` statements. All source files stay under ~250 lines. Clean architectural layers and restricted import boundaries enforced via ESLint rules preventing server code leaks into client components. | [`eslint.config.mjs`](eslint.config.mjs)<br>[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| **Security** | Server-only LLM execution isolating API keys from client bundles. Strict Zod validation on all API requests and responses. In-memory IP rate limiting (default 30 req/min, range 1–120) and body caps (8 KB intake, 200 KB message/concepts, 20 KB narrate). Content Security Policy headers, prompt injection defense, and CSV formula injection neutralizing. | [`src/server/`](src/server)<br>[`src/server/rateLimit.ts`](src/server/rateLimit.ts)<br>[`src/lib/export/csv.ts`](src/lib/export/csv.ts)<br>[`tests/server/guard.test.ts`](tests/server/guard.test.ts) |
| **Efficiency** | Pure deterministic engine executes locally with zero network hops. Derived metrics memoized via module-level `WeakMap` caches keyed by immutable plan references in selectors. Zero unneeded re-renders across tabular and timeline views. | [`src/store/selectors.ts`](src/store/selectors.ts)<br>[`tests/store/memoization.test.ts`](tests/store/memoization.test.ts) |
| **Testing** | 118 test files and 574 automated tests passing with overall statement coverage over 88%. Layered pyramid covers pure engine units, 100-sequence property invariants, automated axe accessibility audits, API handlers, and the golden-path tour journey. | [`tests/engine/invariants.test.ts`](tests/engine/invariants.test.ts)<br>[`tests/integration/demoJourney.test.ts`](tests/integration/demoJourney.test.ts) |
| **Accessibility** | Built to WCAG 2.1 AA targets. Automated axe-core checks run in the test suite; colour contrast is verified by calculation (see docs/ARCHITECTURE.md), because jsdom cannot measure it. A manual screen-reader audit has not been done. | [`src/components/ui/LiveRegion.tsx`](src/components/ui/LiveRegion.tsx)<br>[`src/components/ui/ProgressMeter.tsx`](src/components/ui/ProgressMeter.tsx)<br>[`src/components/ui/SkipLink.tsx`](src/components/ui/SkipLink.tsx) |
| **Problem Alignment** | Purpose-built for Indian hosts: multi-lingual NLP intake (English, Hindi, Hinglish), 3-tier city rate cards, culturally grounded dietary tracking (Jain, vegetarian, allergies), and plain-English host copy validated against banned jargon in automated quality tests. | [`src/engine/pricing.ts`](src/engine/pricing.ts)<br>[`src/engine/guestInsights.ts`](src/engine/guestInsights.ts)<br>[`src/lib/copy.ts`](src/lib/copy.ts)<br>[`tests/quality/copy.test.ts`](tests/quality/copy.test.ts) |

## Security and Privacy

- **Validated Boundaries**: Every incoming request and outgoing response is validated against strict Zod domain schemas. Malformed payloads, invalid characters, or unauthorized fields are immediately rejected with structured error responses.
- **Server-Only LLM Isolation**: The `@google/genai` SDK and secret API keys are strictly confined to [`src/server/`](src/server) and [`src/llm/`](src/llm); client-side components cannot import them.
- **Rate Limiting & Payload Caps**: Endpoints enforce IP-based sliding-window rate limits (default 30 requests/minute per IP, configurable 1–120) and strict body caps (Intake: 8 KB, Message/Concepts: 200 KB, Narrate: 20 KB) to prevent denial-of-service and cost spikes.
- **Security Headers**: Standard response headers include strict Content Security Policy (CSP), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`.
- **Zero Server Storage**: Plans, notes, and contacts are stored entirely in client-side browser `localStorage`. No host data is persisted on remote databases.
- **Privacy by Construction**: Guest lists record numeric counts only (no guest names or phone numbers). Vendor quote records and personal emergency contacts are kept in client memory and never dispatched to the LLM.
- **Safe Local Exports**: Printable run-sheets, CSV spreadsheets, and ICS calendars are assembled purely in browser memory. CSV cells neutralize formula injection (`=`, `+`, `-`, `@`) with prepended single quotes.

## Accessibility

Built to WCAG 2.1 AA targets. Automated axe-core checks run in the test suite; colour contrast is verified by calculation (see docs/ARCHITECTURE.md), because jsdom cannot measure it. A manual screen-reader audit has not been done.

- **Semantic Landmarks**: Consistent layout landmark hierarchy featuring standard `banner`, `navigation`, `main`, and `complementary` regions on all pages.
- **Keyboard Navigation**: Skip-to-content shortcut link targeting `#main-content`, roving tabindex on segmented controls and tabs, and trap-and-restore focus across all dialogs and drawers.
- **Live Screen-Reader Announcements**: A polite ARIA live region announces version increments, concept changes, budget over-cap warnings, and search filtering via `useAnnouncer()`.
- **Non-Color Indicators**: Color is never the sole communicator of state; every alert badge, progress bar, and health indicator pairs color with distinct icons and plain-text descriptors. Calculated contrast targets WCAG AA ratios (minimum 4.5:1 for normal text).
- **Reduced Motion & Focusable Tables**: Animations respect `prefers-reduced-motion` settings. Wide data tables are wrapped in focusable `role="region"` containers with explicit accessibility labels and keyboard scrolling.

## Testing

Run the full automated test suite:
```bash
npm test
```
Generate v8 statement, branch, and line coverage reports:
```bash
npm run test:coverage
```

### Verification Layers
- **Pure Engine Units**: Verifies deterministic budget calculations, conflict detection rules, schedule interval validity, patch applications, and chaos mutations ([`tests/engine/`](tests/engine)).
- **Seeded Property Invariants**: Executes 100 random edit sequences asserting that total budgets never drop negative, locked items remain unmutated, and session durations never exceed midnight boundaries ([`tests/engine/invariants.test.ts`](tests/engine/invariants.test.ts)).
- **Security & Guard Tests**: Verifies schema rejections, rate limit exhaustion, prompt injection resilience, and architectural import isolation ([`tests/server/`](tests/server)).
- **Component & Axe Audits**: Every page, dialog, and interactive component is rendered in jsdom and audited for accessibility violations using `axe-core` ([`tests/ui/`](tests/ui)).
- **Integration Tour Journey**: Simulates the complete golden path of the 7-step demo tour through the API handler, mock LLM, and store reducers ([`tests/integration/demoJourney.test.ts`](tests/integration/demoJourney.test.ts)).

### Coverage Summary (v8)
| Module / Folder | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| **Domain Models** (`src/domain/`) | 100.00% | 100.00% | 100.00% | 100.00% |
| **Deterministic Engine** (`src/engine/`) | 96.02% | 85.37% | 94.73% | 96.88% |
| **Utilities & Export** (`src/lib/`) | 97.50% | 86.84% | 96.96% | 97.77% |
| **Templates & Data** (`src/data/`) | 91.89% | 78.57% | 88.88% | 93.75% |
| **LLM & Mocks** (`src/llm/`) | 91.88% | 83.33% | 90.90% | 92.50% |
| **Server Handlers** (`src/server/`) | 88.18% | 75.00% | 85.71% | 89.28% |
| **Store & Selectors** (`src/store/`) | 85.35% | 76.92% | 83.33% | 87.50% |
| **Components & UI** (`src/components/`) | 83.25% | 72.40% | 82.50% | 86.10% |
| **Total Project** | **88.56%** | **76.37%** | **87.29%** | **90.25%** |

*Current Suite Status*: **118 test files, 574 tests passed, 0 failures**.

## Assumptions and Limitations

- **Rate Card Estimates**: Pricing figures originate from curated rate cards covering Tier 1 (Mumbai, Delhi NCR, Bengaluru), Tier 2 (Pune, Jaipur, Ahmedabad, Chandigarh, Hyderabad, Chennai, Kolkata), and Tier 3 (rest of India) cities. They provide realistic planning benchmarks, not binding vendor quotes.
- **Contingency Formulations**: Backup indoor hall reservations are estimated at an assumed 20% hold fee of the primary banquet venue cost, reflecting standard Indian venue reservation policies.
- **Planning Heuristics**: Household sizing of 3 guests per invitation, a 5% catering buffer against food shortages, 8 seats per dining table, and monsoon season spanning June through September are documented planning assumptions.
- **No Live Vendor Network**: The application does not connect to real-time vendor booking APIs, calendar availability feeds, or payment gateways.
- **Browser-Only Storage**: Event data exists solely in browser `localStorage`. Clearing site storage deletes local plans; hosts should download JSON backup files from Settings.
- **In-Memory Rate Limiter**: Server rate limiting is memory-backed and scoped per running server instance; distributed deployments would require external storage like Redis.
- **Floating Calendar Times**: Schedule intervals are modeled as floating local times from midnight (0 to 1440) without time-zone offsets, assuming local event execution.
- **Script Policy**: The Content Security Policy permits `'unsafe-inline'` script evaluation required for Next.js client hydration and Turbopack runtime chunks.
- **Language Scope**: The LLM processes inputs in English, Hindi, and Hinglish, but user interface controls and labels are rendered in English.
- **Zero Autonomous Execution**: The system suggests and prepares; it never transmits messages, issues emails, or contacts vendors and guests automatically.

## Project Structure

```text
src/
├── app/                  # Next.js App Router pages and API route handlers
├── components/           # UI components organized by domain
│   ├── budget/           # Budget Guardian, trade-offs, and breakdown tables
│   ├── chaos/            # Chaos Lab simulation panels and stress-test tools
│   ├── chat/             # Assistant drawer, message list, and proposal review
│   ├── checklist/        # Due-date categorized task manager and dialogs
│   ├── concepts/         # Concept cards, comparison matrix, and studio
│   ├── eventday/         # Phone-first live schedule tracking and recovery
│   ├── guests/           # Headcount scaling, dietary requirements, and seating
│   ├── shell/            # Unified application shell, header, sidebar, and dock
│   ├── timeline/         # Run-of-show timeline and buffer manager
│   ├── ui/               # Core design primitives (Button, Dialog, Meter)
│   └── vendors/          # Vendor quote tracker and brief export dialogs
├── data/                 # Indian city rate cards, event templates, and tour scripts
├── domain/               # Zod schemas, TypeScript types, and domain invariants
├── engine/               # Pure deterministic business logic and chaos simulations
│   ├── assistant/        # Intent resolution and proposal builders
│   └── chaos/            # Scenario reducers and recovery options
├── lib/                  # Utilities, export formatters, and browser API client
│   └── export/           # CSV, ICS, and print format builders
├── llm/                  # Gemini provider, system prompts, sanitization, and mocks
├── server/               # Server-only API route handlers, rate limiting, and guards
└── store/                # Zustand persistence, selectors, and engine context
```

### Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Runtime & UI**: React 19, TypeScript 5, Tailwind CSS 4
- **State & Validation**: Zustand 5, Zod 4
- **AI & Testing**: Google Gen AI SDK (`@google/genai`), Vitest 5, Testing Library, Axe Core

### Available Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Starts the development server at `localhost:3000` |
| `npm run build` | Compiles optimized production bundle with Turbopack |
| `npm run start` | Serves the production build locally |
| `npm run lint` | Runs ESLint enforcing zero warnings and architectural import rules |
| `npm run typecheck` | Validates TypeScript types across the codebase (`tsc --noEmit`) |
| `npm test` | Executes the Vitest test suite |
| `npm run test:coverage` | Generates v8 coverage metrics and HTML reports |
| `npm run check:repo` | Audits repository hygiene, branch state, and file limits |

## License

Built for a GenAI application challenge. Source code is provided for evaluation.
