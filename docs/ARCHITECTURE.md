# Momently Architecture Guide

## 1. Purpose and Core Principle

Momently is a GenAI-powered celebration and event planner designed for weddings, birthdays, anniversaries, and community events, managing budgets, timelines, vendor checklists, and personalized ideas.

### The Core Principle: "LLM Proposes, Engine Decides"

The system adheres strictly to the rule: **the LLM proposes, a deterministic engine decides**.

- **No Hallucinated Math or Rules**: All budget arithmetic, constraint evaluations, schedule conflict detections, and business logic live exclusively in pure TypeScript functions within the deterministic engine, never inside LLM prompts or completions.
- **Untrusted Proposals**: LLM suggestions are treated as unverified candidate proposals. Every suggestion is parsed and validated against strict Zod schemas, transformed into a typed `PlanPatch`, and verified by the engine.
- **User Agency and Approval**: Verified patches are applied to the active plan only after user inspection and approval, ensuring transparent and predictable event planning.

---

## 2. Planned Project Structure

The project is structured into modular, single-responsibility boundaries:

- `src/domain/`: Domain models, Zod validation schemas, inferred TypeScript types, and domain constants (e.g., event definitions, budget line items, timeline milestones, vendor categories).
- `src/engine/`: Pure business logic functions without I/O or side-effects (e.g., budget calculations, milestone sequencing, conflict detection, patch application).
- `src/llm/`: LLM infrastructure including provider interfaces, Gemini implementation, mock provider, prompt templates, and structured JSON response schemas.
- `src/data/`: Static domain reference data, regional rate cards, event templates (wedding, birthday, anniversary, community event), and reproducible demo scenarios.
- `src/store/`: Client-side state management using Zustand for active plan management, applied patches, undo/redo states, and user interactions.
- `src/lib/`: Shared utility libraries (e.g., INR currency formatting, date/time calculations, ID generation, ICS calendar and CSV export, input sanitization).
- `src/components/`: Modular React UI components organized by feature and design system.
- `src/app/`: Next.js App Router pages, layouts, and server-side API routes (`/api/...`).
- `tests/`: Automated unit, integration, and smoke test suites using Vitest and React Testing Library.

---

## 3. Engineering Conventions

To maintain strict code quality, correctness, and maintainability, the following conventions are enforced:

- **Monetary Values**: Stored exclusively as integer INR rupees (never floating-point numbers) to avoid precision errors.
- **Dates**: Stored as ISO 8601 calendar date strings in `YYYY-MM-DD` format.
- **Times**: Stored as integer minutes since midnight (`0` to `1439`) to eliminate timezone drift during timeline math.
- **Engine Purity**: Every engine function must be pure, deterministic, and return new objects without mutating inputs.
- **JSDoc Documentation**: Every exported function must include JSDoc comments explaining _WHY_ it exists, its parameters, and return value.
- **File Limits**: Files should remain under ~200 lines and maintain a single, cohesive responsibility.
- **Type Strictness**: Strict TypeScript (`noImplicitOverride`, `noUncheckedIndexedAccess`, `strict: true`). The `any` type is strictly forbidden.
- **Exports**: Named exports only throughout the codebase, except for Next.js App Router files (pages, layouts, error handlers) where default exports are required by the framework.
- **Naming Conventions**: Clear, descriptive names without cryptic abbreviations.
- **Error Handling**: Engine functions return typed result unions (e.g., `{ success: true, data: T } | { success: false, error: E }`). Exceptions are thrown only at API route and external boundary layers.
- **Console Usage**: No `console.log`. Only `console.warn` and `console.error` are allowed for unexpected operational conditions.
- **Hygiene**: No dead code or unresolved `TODO` comments in committed code.
- **Commit Messages**: All git commits must adhere to the Conventional Commits specification.

---

## 4. Data-Flow Architecture

```
UI -> store -> engine; UI -> /api route -> LLM provider -> zod validation -> PlanPatch -> engine.applyPatch -> approval -> store.
```

### Flow Breakdown

1. **Deterministic User Actions**:
   `User interaction in UI -> Zustand Store -> Engine pure function -> Updated Store state -> UI update`

2. **AI-Assisted Proposals**:
   `User prompt in UI -> /api endpoint -> LLM Provider (Gemini / Mock) -> Zod Schema Validation -> Typed PlanPatch -> Engine Validation (applyPatch simulation) -> User Review/Approval Modal -> Store Commit -> UI update`

---

---

## 5. LLM Layer

The LLM layer is strictly an untrusted translation boundary: it converts unstructured natural language into validated structured data, or transforms verified engine facts into warm, conversational text.

### The Task Table

| Task Name | Purpose | Temperature | Max Tokens | Timeout | Output Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `intake` | Extracts event type, city, date, guest count, budget cap, setting, and style preferences from initial host brief | 0.1 | 2048 | 15s | `intakeOutputSchema` (rejects budget_cap and guest_count in constraints) |
| `concepts` | Synthesizes 3 genuinely distinct celebration concepts (budget-lean, balanced, signature) with rate-card quality profiles | 0.7 | 3000 | 20s | `conceptsOutputSchema` (enforces exactly 3 concepts, validated quality profiles) |
| `intent` | Classifies host follow-up requests against the active plan into typed action intents | 0.1 | 1024 | 10s | `intentOutputSchema` (discriminated union of 18 typed intents) |
| `narrate` | Generates short, warm narrative summaries grounded purely in verified engine facts | 0.4 | 1024 | 10s | `narrateOutputSchema` (max 700 chars, up to 4 key highlights) |

### The Trust Boundary

- **No State Mutation**: The LLM NEVER touches active plan state. It produces candidate data that must be converted into engine `PlanPatch` operations.
- **No Financial Math**: The LLM NEVER calculates monetary totals, discounts, or rate calculations. All arithmetic is performed by deterministic pure engine functions.
- **No External Agency**: The LLM NEVER contacts external vendors, places bookings, or executes side-effects.
- **Strict Defensive Validation**: All provider completions pass through JSON extraction and strict Zod parsing. If an output fails schema validation, the pipeline attempts a single targeted correction retry before returning an explicit error.

---

## 6. Assistant Orchestration (Proposal Bridge)

The assistant engine (`src/engine/assistant/`) provides the pure, non-mutating bridge between validated LLM extractions and approvable engine proposals:

```text
User Text -> LLM (intent task) -> IntentOutput -> resolveIntent -> AssistantOutcome (proposal) -> User Approval -> applyPatch
```

- **Intake Synthesis (`fromIntake.ts`)**: Converts structured briefs into an initialized `EventPlan`. Every default (e.g. 50 guests, tier-2 city pricing, undecided setting) is explicitly recorded in `assumptions`, and past dates relative to the reference date are omitted.
- **Concept Operations (`concepts.ts`)**: Applies concept quality profiles (`selectConceptOps`), computes true previewed totals with dynamic contingency (`priceConcept`), and supports hybrid combination with target savings (`combineConcepts`).
- **Intent Resolution (`resolveIntent.ts`)**: Dispatches all 18 intent kinds through focused pure resolvers without side-effects. Conflicting requests return structured conflict explanations and funding paths rather than silent compromises.
- **Approvable Proposals**: Nothing in the assistant layer directly mutates plan state. Every actionable response is returned as an approvable `RecoveryOption` (source `'user'`), maintaining the strict invariant: *LLM proposes, engine decides, user approves*.

---

## 7. Stateless Server & API Architecture

Momently operates as a strictly stateless API backend:

```text
Client (holds plan state) --[Request + Plan Payload]--> Next.js API Route (/api/*)
                                                            |
                                                guardRequest (Origin, RateLimit, Size)
                                                            |
                                                safeParse (eventPlanSchema)
                                                            |
                                                runWithFallback (Primary / Mock)
                                                            |
                                                Engine Execution (Pure Function)
                                                            |
Client (receives Proposal) <--[Structured Response]---------+
```

- **Stateless Principle**: The server holds zero plan data in memory, sessions, or backend databases. The client transmits the active plan with each request, and the server validates every byte it receives.
- **Thin Route Handlers**: Route files (`src/app/api/*/route.ts`) contain only edge exports (`runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 30`) and delegate immediately to testable handler functions taking `(Request, Deps) => Promise<Response>`.
- **Architectural Boundary**: ESLint `no-restricted-imports` forbids client-side components (`src/components/**`), stores (`src/store/**`), and utility libraries (`src/lib/**`) from importing server-only modules (`src/server/**`).

---

## 8. Security

### The Six-Pillar Threat Model & Controls

1. **Prompt Injection & Prompt Leaks**:
   - *Threat*: Adversarial user input attempting to hijack system prompts, extract hidden model instructions, or bypass safety filters.
   - *Control*: Untrusted inputs pass through `sanitizeUserText` (NFKC Unicode normalization, control character stripping, newline collapsing, and length truncation). Inputs are bounded in `<user_text>` XML data blocks with delimiter escaping (`wrapUntrusted`) and audited via `detectInjectionAttempt`. Output is strictly constrained to typed JSON schemas.

2. **Malicious & Bloated Payloads (DoS / Memory Exhaustion)**:
   - *Threat*: Attackers submitting multi-megabyte payloads, deeply nested JSON, or oversized arrays to crash the Node process.
   - *Control*: Strict body reader `readJsonBody` enforces Content-Type verification (`application/json`), header `Content-Length` checks, and stream byte length enforcement (`MAX_BODY_BYTES_INTAKE 8KB`, `MAX_BODY_BYTES_MESSAGE 200KB`, `MAX_BODY_BYTES_NARRATE 20KB`). Domain schemas enforce hard bounds on arrays (`eventPlanSchema` restricts constraints &le; 40, concepts &le; 3, budget items &le; 60, schedule slots &le; 40, tasks &le; 80, vendors &le; 20, quotes &le; 10, ledger &le; 500).

3. **API Key & Secret Leakage**:
   - *Threat*: Exposing Gemini API keys or internal credentials to the browser, client telemetry, or error messages.
   - *Control*: Server-only LLM infrastructure enforced by ESLint architectural restrictions. All error responses return uniform, scrubbed `ApiErrorBody` envelopes with generic error messages. No stack traces, file paths, or internal error text are ever surfaced to clients.

4. **Abuse, Token Depletion & Cost Spikes**:
   - *Threat*: Automated scripts exhausting API quotas and incurring extreme cloud billing through repeated AI generation requests.
   - *Control*: Bounded in-memory sliding-window rate limiter per client IP/key (`createRateLimiter`), enforcing 30 requests/minute (configurable 1-120) with HTTP 429 and `Retry-After` headers. Tracks a maximum of 5,000 clients with LRU eviction. The `runWithFallback` pipeline transparently routes provider outages to `MockProvider`, preventing cascading retries.

5. **Cross-Origin Request Forgery (CSRF) & Cross-Origin Abuse**:
   - *Threat*: Malicious third-party websites issuing unauthorized state mutation requests using victim browser contexts.
   - *Control*: Strict same-origin validation (`originGuard.checkSameOrigin`). Requests carrying an `Origin` header that does not match the request `Host` or `x-forwarded-host` are rejected with HTTP 403 `forbidden_origin`.

6. **Cross-Site Scripting (XSS) & Clickjacking**:
   - *Threat*: Injecting malicious scripts into host views or framing the application within transparent overlay clickjack attacks.
   - *Control*: Comprehensive HTTP security headers (`buildSecurityHeaders`): Content-Security-Policy with `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. Disables `unsafe-eval` outside local development. Sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy` denying camera, microphone, geolocation, and payment APIs.

### Known Limitations

- **In-Memory Rate Limiter**: The sliding-window rate limiter maintains state in server memory per process instance. In multi-region or distributed serverless environments, an external Redis or edge proxy limiter (e.g. Cloudflare WAF) should be placed in front.
- **Client IP Extraction**: Behind unproxied direct connections, `x-forwarded-for` and `x-real-ip` headers can be spoofed by callers. Production deployments must run behind a trusted reverse proxy that strips untrusted client headers.
- **Inline Script CSP**: Next.js App Router relies on inline scripts for client hydration and bootstrap without a nonce setup, necessitating `'unsafe-inline'` for `script-src`. A nonce-based CSP configuration via Next.js middleware is recommended for future hardening.

---

## 9. Efficiency

- **Zero Server State**: Eliminating server sessions and plan caching on the server eliminates database sync overhead, memory leaks, and complex cache invalidation bugs.
- **In-Memory LLM LRU Cache**: `LlmCache` computes deterministic SHA-256 hashes of task inputs (`stableStringify`), caching validated responses with TTL expiration to prevent duplicate provider round-trips.
- **Client-Side Engine Computations**: Dynamic budget totals, schedule cascading, cost-saving levers, and risk scoring execute purely on the client inside Zustand stores without server network latency.
- **Resilient Fallback Gating**: `runWithFallback` detects provider-level downtime, rate limits, or persistent schema validation errors, immediately degrading to `MockProvider` and avoiding repeated failing network calls.

---

## 10. Engine Overview

### Core Invariant

**Every consequential change is a proposed patch that needs approval.** The deterministic engine never mutates active plans behind the scenes, never hallucinates numbers, and never contacts external vendors. All business logic evaluates hypothetical outcomes through preview patches that require explicit host confirmation.

- **Pricing (`src/engine/pricing.ts`)**: Resolves rate card entries into exact integer INR line items. Computes per-guest and flat-rate costs using tiered regional multipliers, guest count bands, and event category scalers.
- **Budget (`src/engine/budget.ts`)**: Acts as the single source of truth for financial totals, category breakdowns, and dynamic contingency reserve recalculations based on event type and venue setting.
- **Patch Engine (`src/engine/patch.ts`, `src/engine/patchOps.ts`, `src/engine/patchBudgetOps.ts`)**: Applies atomic, validated `PlanPatchOp` operations, enforces item locks (permitting explicit unlocks), refreshes contingency, and appends immutable audit records to the plan ledger.
- **Conflicts & Feasibility (`src/engine/conflicts.ts`, `src/engine/feasibility.ts`, `src/engine/conflictRules.ts`)**: Identifies structural, financial, and logistical conflicts (e.g. caps below essential floor, monsoon exposure, unverified accessibility routes) and generates actionable resolution options.
- **Budget Guardian (`src/engine/guardian.ts`, `src/engine/upgradeProposal.ts`)**: Assesses additions against budget caps, formulates greedy multi-step savings plans, and structures upgrade proposals with transparent trade-offs.
- **Cost-Saving Levers (`src/engine/levers.ts`)**: Evaluates granular cost-saving primitives by stepping down item quality tiers or removing optional lines, sorted deterministically by guest experience impact.
- **Schedule Delay Planning (`src/engine/scheduleDelay.ts`, `src/engine/scheduleDelayStrategies.ts`)**: Validates timeline gaps, overlaps, and buffers. Proposes cascade, absorb (slot shrinking and optional drops), and slot swapping strategies for unexpected delays.
- **Chaos Score & Risk (`src/engine/risk.ts`)**: Computes a transparent, weighted 0-100 risk score and categorizes event readiness into calm, manageable, exposed, and fragile bands.
- **Chaos Lab Scenarios (`src/engine/chaos/`)**: Simulates crisis situations (sudden rain, budget cuts, guest surges, vendor cancellations, late starts, missing inventory) producing structured recovery proposals without side-effects.

---

## 11. Accessibility & Design System

### Design Philosophy: "The Elegant Event-Planning Studio"

Momently avoids cold corporate AI dashboard aesthetics in favor of a warm, distinguished studio atmosphere. Warm ivory backdrops, deep imperial plum primary accents, golden highlights, and refined serif typography evoke the celebratory gravitas of milestone event planning while rigorously enforcing WCAG 2.1 AA accessibility.

### Design Tokens & Palette

- **Surfaces**:
  - Main Background (`--color-bg`): `#FBF7F2` (Warm ivory)
  - Surface Card (`--color-surface`): `#FFFFFF` (Pure white)
  - Surface Muted (`--color-surface-muted`): `#F4EDE6` (Soft alabaster)
  - Surface Border (`--color-border`): `#E6DCD2` (Subtle warm stone)
- **Typography & Ink**:
  - Primary Ink (`--color-ink`): `#2B1B2E` (Deep plum charcoal)
  - Secondary Ink (`--color-ink-muted`): `#5B4A5E` (Warm slate plum)
  - Display Headings: `ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif`
  - Body Copy: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (16px base, line-height 1.6)
- **Brand Identity**:
  - Primary (`--color-primary`): `#6B2D5C` (Deep royal plum)
  - Primary Hover (`--color-primary-hover`): `#55224A`
  - On-Primary (`--color-on-primary`): `#FFFFFF`
  - Gold Accent (`--color-gold`): `#D4A24C` (*strictly decorative*; never used as text)
  - Gold Text (`--color-gold-text`): `#8A5A00` (High-contrast amber gold)
- **Semantic Status**:
  - Success: `#1F6F54` on `#E7F4EE`
  - Warning: `#8A5A00` on `#FFF4DC`
  - Danger: `#A12B3A` on `#FBE9EB`
  - Info: `#2B5C8A` on `#E8F0F8`
- **Global Focus Ring**:
  - `:focus-visible`: `3px solid #1D4F91` with `2px` offset globally enforced across all interactive controls.

### Calculated Contrast Ratios (WCAG 2.1 Audit)

All core text and button foreground/background pairings exceed the WCAG AA minimum threshold of 4.5:1:

| Element Pairing | Foreground | Background | Calculated Ratio | WCAG Compliance |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Ink on Canvas** | `#2B1B2E` | `#FBF7F2` | **15.16:1** | Pass (AAA) |
| **Primary Ink on Surface** | `#2B1B2E` | `#FFFFFF` | **16.17:1** | Pass (AAA) |
| **Primary Ink on Muted** | `#2B1B2E` | `#F4EDE6` | **13.94:1** | Pass (AAA) |
| **Secondary Ink on Canvas** | `#5B4A5E` | `#FBF7F2` | **7.61:1** | Pass (AAA) |
| **Secondary Ink on Surface** | `#5B4A5E` | `#FFFFFF` | **8.12:1** | Pass (AAA) |
| **White on Primary Button** | `#FFFFFF` | `#6B2D5C` | **9.74:1** | Pass (AAA) |
| **White on Primary Hover** | `#FFFFFF` | `#55224A` | **12.25:1** | Pass (AAA) |
| **Gold Text on Canvas** | `#8A5A00` | `#FBF7F2` | **5.56:1** | Pass (AA) |
| **Success Text on Soft Bg** | `#1F6F54` | `#E7F4EE` | **5.37:1** | Pass (AA) |
| **Warning Text on Soft Bg** | `#8A5A00` | `#FFF4DC` | **5.43:1** | Pass (AA) |
| **Danger Text on Soft Bg** | `#A12B3A` | `#FBE9EB` | **6.15:1** | Pass (AA) |
| **Info Text on Soft Bg** | `#2B5C8A` | `#E8F0F8` | **6.08:1** | Pass (AA) |
| **Focus Ring on Surface** | `#1D4F91` | `#FFFFFF` | **8.14:1** | Pass (AAA) |

### Accessibility Architectural Principles

1. **Semantic Landmark Architecture**:
   - `header` (Banner landmark: brand wordmark, demo mode badge, mobile nav trigger).
   - `nav[aria-label="Main"]` (Primary application navigation).
   - `main#main-content` (Target of keyboard `SkipLink`).
   - `aside[aria-label="Assistant"]` (Complementary AI event co-pilot dock).
2. **Keyboard Navigation & Roving Tabindex**:
   - `Tabs` implement the WAI-ARIA Tabs pattern with roving tabindex (`tabindex="0"` for the active tab, `"-1"` for others). Arrow keys traverse tabs with wraparound; `Home` and `End` jump to the first and last tabs.
   - `Dialog` and `Drawer` utilize the native HTML `<dialog>` element. Focus is captured on open and returned directly to the initiating trigger upon closure. The `cancel` event dismisses on Escape.
3. **Screen Reader Live Announcements**:
   - `LiveRegionProvider` hosts an unobtrusive, polite `aria-live="polite"` region dispatched via the `useAnnouncer()` hook for runtime plan events.
   - `TextArea` character counter suppresses noisy per-keystroke announcements, triggering announcements only when crossing 80%, 90%, and 100% capacity thresholds.
4. **No Color-Only State Indicators (WCAG 1.4.1)**:
   - `ProgressMeter`, `ProvenanceBadge`, `DecisionStatusPill`, and `Badge` always pair distinct icon glyphs (`check`, `alert`, `lock`, `sparkle`) and explicit textual status alongside background hues.
5. **Reduced Motion & Print Optimization**:
   - `@media (prefers-reduced-motion: reduce)` resets all transitions and animations to 0.01ms and halts button loading spinners.
   - `@media print` suppresses headers, navigation sidebars, and assistant docks, yielding an ink-friendly high-contrast layout for on-site event day execution.
6. **44px Target Size**:
   - All standard touch targets (`Button` md, inputs, selects, textareas) enforce a minimum 44x44px boundary per WCAG 2.5.8.

### Why Zero Web Fonts & Zero External Images

- **Instant Zero-Layout-Shift Loading**: Using system display serif and sans-serif stacks eliminates Flash of Invisible Text (FOIT), Flash of Unstyled Text (FOUT), and layout shifts without external HTTP roundtrips.
- **Privacy & Security**: Zero third-party web font trackers or image CDNs ensure host data and IP addresses remain private.
- **Lightweight Standalone Visuals**: `CoverArt` provides deterministic, seed-hashed layered SVG covers standing in for stock photos while keeping bundle size compact and 100% offline-ready.

---

## 12. Testing & Quality Standards

- **Zero-Warning Pipeline**: Strict enforcement of `tsc --noEmit`, ESLint with architectural boundary rules, Prettier, and Vitest.
- **Automated Accessibility Testing**: Every primitive, shell landmark, and route skeleton is verified with `expectNoAxeViolations()` powered by `axe-core`.
- **Heading Order Verification**: All views enforce exactly one `<h1>` per route with strictly sequential heading hierarchies (`h1` -> `h2`).
- **Pure Unit Tests**: Deterministic clock and ID injection ensures tests execute reliably across local and CI environments without network dependencies.

---

## 13. Client State Architecture

Momently's client-side state is managed through Zustand (`src/store/eventsStore.ts`) paired with the deterministic engine (`src/engine/`):

### The Single Write Path

All plan modifications strictly follow a single, validated write path:
```text
User Gesture in UI
       │
       ▼
store.approveAndApply(eventId, patch, { basedOnVersion })
       │
       ├─► 1. Staleness Check: plan.version === basedOnVersion
       │
       ├─► 2. Audit Snapshot: createSnapshot(preChangePlan, reason) (max 25)
       │
       ├─► 3. Engine Invocation: engine.applyPatch(preChangePlan, patch, ctx)
       │
       └─► 4. Store Update & Recency Reorder: moves updated event to head of order
```
Direct user mutations (such as checklist toggles, quote entries, or budget tweaks) build a user-sourced patch via `createPatch` and route through `store.applyUserEdit`, which delegates directly to the exact same write path. ESLint architectural boundaries (`no-restricted-imports`) strictly forbid UI components (`src/components/**`) and App Router pages (`src/app/**`) from invoking `engine.applyPatch` directly. Read-only previews (`previewOps`) remain permitted for speculative what-if calculations.

### Staleness Protection

In collaborative or multi-turn conversational workflows, an assistant proposal might be based on an earlier plan revision (e.g., version 2). If the host manually edits guest counts or renames items in the interim (advancing the plan to version 3), applying the older proposal could silently overwrite concurrent user edits.
To guarantee consistency, `approveAndApply` takes `{ basedOnVersion }` and rejects stale proposals with error code `"stale_plan"` if `plan.version !== basedOnVersion`, leaving store state untouched.

### Persistence with Validation on Load

Persistence is managed using Zustand's `persist` middleware backed by a resilient wrapper (`safeStorage.ts`):
- **Resilient Storage**: `safeStorage` wraps `window.localStorage` in `try/catch` handlers for every read, write, and removal, gracefully degrading to an in-memory storage map in environments where `localStorage` throws (e.g. Safari private browsing, disabled cookies, storage quota exceeded, or SSR).
- **Strict Validation on Hydration**: `hydrate()` loads stored data from key `"momently.v1"` and validates every saved event against `eventRecordSchema` (which validates the complete `eventPlanSchema`, capped history snapshots, and messages). If corrupt or outdated schema items are encountered, they are dropped and an accessible user notice is displayed (`"N saved event(s) couldn't be loaded"`). The application never crashes on corrupted data.
- **Quota & Size Guard**: If the serialized storage footprint exceeds 2,500,000 characters (~2.5 MB), the store automatically prunes the oldest historical plan snapshots (`PlanSnapshot`) across events before persisting, guaranteeing that active celebration plans are never dropped or truncated due to browser storage limits.

### Local-Only Architecture Rationale

Celebration plans are stored exclusively within the user's browser, by deliberate architectural design:
1. **Privacy First**: Celebration plans contain intimate personal details—guest headcounts, financial budgets, religious traditions, family milestones, and venue choices. Storing data locally ensures hosts maintain full ownership and privacy over their personal celebrations without creating tracking profiles.
2. **Zero Database Operational Footprint**: Eliminating cloud databases eliminates database breaches, credential exposure, synchronization latency, and server infrastructure costs.
3. **Instant Offline Readiness**: Hosts can draft, inspect, and fine-tune celebrations with zero latency, even on flaky event-venue Wi-Fi or offline mobile connections.

---

## 14. Review and Approval UX

Momently's host user experience guarantees host agency, financial safety, and full accessibility across all proposal review interactions (including assistant chat suggestions, Chaos Lab recovery plans, and concept studio direction switches).

### The Proposal -> Preview -> Fund -> Approve -> Apply Lifecycle

```
[Proposal] ──► [Preview Ops] ──► [Funding Step (if over cap)] ──► [Host Consent] ──► [Apply Patch]
(LLM/Chaos)    (Deterministic    (Guardian Levers &               (Approve Button)   (Store & History
                Impact Diffs)     withFunding Combination)                            Snapshot)
```

1. **Proposal**: Candidate changes are generated by the LLM or Chaos Lab engine as untrusted `RecoveryOption` records with status `"proposed"`.
2. **Preview**: The deterministic engine executes speculative dry-runs (`previewOps`) against active plan state. It computes line-item diffs (`ImpactSummary`), recalculates Chaos fragility risk bands (`ScoreDelta`), and compiles the explicit consent requirements list ("You'd be approving:").
3. **Fund**: If a proposed option exceeds the host's budget cap, the engine's Budget Guardian evaluates available quality and scope levers (`suggestSavings`). The host is presented with an interactive "Choose how to fund it" step (`<fieldset>` with `<legend>`). Selecting a strategy calls `withFunding`, combining proposal operations with funding levers, deduplicating target items (later strategy operations take precedence), and recalculating impact to restore financial viability.
4. **Approve**: Host approval is explicitly recorded. While a hard budget cap remains breached, the "Approve this change" button is disabled with visible plain-language explanation; the engine never allows applying violating patches.
5. **Apply**: Upon approval, `useApproveOption` submits the approved patch with `{ basedOnVersion }` through `store.approveAndApply`. The store appends an audit snapshot to history, increments `plan.version`, and announces the result through the accessible live region.

### Why Stale Proposals Are Blocked

In asynchronous, collaborative, or multi-turn conversational planning, proposals can easily become outdated if the host edits plan items (such as headcount, venue city, or date) while a suggestion is pending.
- `useApproveOption` captures `plan.version` at render time as `basedOnVersion`.
- If `plan.version !== basedOnVersion`, the store rejects the change with code `"stale_plan"`.
- The UI immediately disables approve buttons, surfaces a warning alert (`"The plan changed since this suggestion was made. Please ask again."`), and dims the outdated proposal card with an `"Out of date"` badge to prevent accidental overwrites of newer host edits.

### Why Approve is Disabled When a Hard Cap Would Be Broken

Momently treats host budget caps as unbreakable contracts:
- The engine's patch applicator (`applyPatch`) evaluates `findViolations`. Any patch exceeding hard constraints is aborted with `hard_constraint_violation`.
- In the UI, rather than letting the host trigger an inevitable server or engine failure, `OptionCard` checks `meetsCap` and `impact.overCap`.
- When a hard cap would be exceeded, the "Approve this change" button is disabled, a prominent visual explanation explains why the engine would reject the change, and the UI guides the host to either choose a funding lever or raise the budget cap via the conflict resolution flow.

### Non-Colour-Only Status Rules

Per WCAG 2.1 Success Criterion 1.4.1 (Use of Color):
- Color is never used as the single visual medium to convey budget status, risk severity, or conflict levels.
- Over-cap and within-cap indicators in `ImpactSummary` and `PlanHealthStrip` pair background tints with explicit textual descriptions (`"Over budget cap by ₹X"` vs `"Within budget cap"`) and SVG icons (`alert` vs `check`).
- Chaos risk score deltas (`ScoreDelta`) explicitly display numerical scores, named risk bands, and direction arrows: `"Chaos Score 58 -> 41 (exposed -> manageable)"`.
- Conflict cards pair colored tones with clear textual severity badges (`"Blocking Conflict"` vs `"Plan Warning"`).
- Screen readers receive updates through polite live regions only on status transitions (such as cap breaches or band shifts), ensuring an accessible experience across visual and assistive modalities.

---

## 15. Budget Guardian UX

The Budget Guardian dashboard (`/events/[id]/budget`) provides hosts with deterministic financial tools, live headcount simulation, and real-time floor protection.

### Pure Engine Driver (Forms -> Typed Intent -> Local Resolution)

Every budgeting tool in the Budget Guardian operates completely offline without network latency or LLM dependencies:
1. **Structured Forms**: Interactive cards (Affordability Check, Target Savings, Quality Upgrades, Style Prioritization, Hidden Gotchas) collect typed host inputs.
2. **Typed Intents**: Forms construct explicit domain intents (`afford_check`, `save_money`, `upgrade`, `make_it_premium`, `find_forgotten`, `change_guest_count`).
3. **Pure Engine Resolution**: Intents dispatch directly to `resolveIntent(plan, intent, ctx, today)`. The pure engine computes answers against local city rate cards, mathematical floor rules, and contingency calculations.
4. **Instant Outcomes**: Results are returned immediately as an `AssistantOutcome` (proposal, conflict, or info) and rendered via `AssistantOutcomeView`.
5. **Stale Protection**: Any background or manual mutation that increments `plan.version` immediately invalidates active outcomes, preventing outdated suggestions from being applied.

### User-Edit Safety Path (Preview, Then Save or Fund)

Manual mutations across the line-item ledger (adding, editing, locking, removing) flow through the `useUserEdit` hook to protect hard spending contracts:
1. **Speculative Preview**: `previewOps(plan, ops, ctx)` computes the mathematical impact without modifying plan state.
2. **Feasibility Evaluation**:
   - **Safe within cap / Flexible target**: The mutation is immediately persisted through `store.applyUserEdit`, the plan version increments, and screen readers receive a live announcement (`"Saved. Budget now ₹X."`).
   - **Hard cap breach**: The mutation is **aborted immediately**—the plan is never left half-edited. The hook formulates a recovery proposal via `buildOption` and generates targeted funding strategies (`suggestSavings(overBy)`), protecting the edited service family.
3. **Host-Driven Resolution**: The host can either choose an interactive funding trade-off to offset the cost or adjust their budget cap via the conflict flow.

### Provenance Rules

Every line item in Momently tracks its epistemic origin through the `provenance` field:
- **`estimate`**: Generated by Momently rate-card benchmarks. Automatically reprices when headcount shifts or when changing host city rate tiers.
- **`user`**: Explicitly set or entered by the host. Immune to automated repricing, protecting human planning choices.
- **`verified`**: Confirmed vendor quote entered with explicit verification consent. Highlighted with a green verified badge and locked into financial projections.

### Non-Destructive Version History Semantics

Momently guarantees that no planning milestone or historical iteration is ever destroyed:
1. **Immutable Decision Ledger**: Every host edit, approved AI proposal, Chaos mitigation, and system adjustment appends a `DecisionRecord` to `plan.ledger`.
2. **Historical Snapshots**: Pre-change states are captured in `event.history` as immutable `PlanSnapshot` objects before applying approved mutations.
3. **Forward-Only Restorations**: Restoring an older snapshot via `store.restoreVersion` does **not** erase subsequent history or roll back clocks. Instead, it creates a brand new version (`current.version + 1`), adopts the snapshot data, retains the event ID, and appends a `"Restored version N"` record to the ledger. Hosts can freely compare diffs across iterations and switch back at any time.

---

## 16. Chat and Guided Demo

Momently's conversational assistant (`src/components/chat/`) and guided demo tour (`src/components/demo/TourBar.tsx`) bring natural-language co-planning into the studio while strictly upholding host agency.

### The Chat Flow

```text
Host Message -> /api/message -> LLM (intent) -> resolveIntent -> AssistantOutcome (Proposal) -> Host Approval -> store.approveAndApply
```

1. **Context-Aware Modes**: `ChatProvider` adapts automatically to the current route. Inside `/events/[id]`, it runs in `"event"` mode against the active celebration plan; elsewhere, it runs in `"intake"` mode, submitting new event briefs to `/api/intake` and navigating to the generated concepts studio.
2. **Untrusted Classification & Pure Resolution**: In event mode, sending a message records the user turn with `basedOnVersion = plan.version`, sends the message and recent conversation context (`recentMessages`, up to 6 turns truncated to 300 chars) to `/api/message`, classifies the request into a typed `IntentOutput`, and resolves it through the pure `resolveIntent` engine into an `AssistantOutcome`.
3. **Explicit Host Approval**: The chat assistant **never** mutates a plan on its own. Actionable suggestions are rendered via `AssistantOutcomeView` and `OptionCard`, requiring an explicit click on `"Approve this change"` (routed through `store.approveAndApply` with staleness protection). Once a change is approved and `plan.version` increments, earlier proposal cards in the chat log automatically dim with an `"Out of date"` badge.

### Slim Request Payloads (`slimPlanForRequest`)

Because Momently's backend is stateless, the client sends the active `EventPlan` with `/api/message` and `/api/concepts` requests. While the client retains up to 500 immutable audit records in `plan.ledger`, the server only needs the current state to classify and resolve intents. `slimPlanForRequest(plan)` sends a shallow copy with `ledger` trimmed to the 20 most recent entries, keeping request payloads well under 60 KB while the client applies approved patches to its own full plan without losing any audit history.

### Memory-Only Outcomes & Reload Expiry

Persisting full `AssistantOutcome` trees (containing candidate `PlanPatch` payloads, multi-item diffs, and speculative savings levers) in `localStorage` would bloat browser storage and risk rehydrating stale patches across sessions. Instead:
- Compact plain-text summaries (`outcomeToText`, capped at 600 characters) are persisted in `event.messages`.
- Full interactive `AssistantOutcome` objects live exclusively in memory (`store.outcomes`).
- After a page reload, persisted assistant messages render their saved text alongside a transparent note (`"Suggestions expire when you reload: ask again to see them"`).

### Guided Demo Tour Invariant: Never Auto-Approve

The 6-step guided tour (`DEMO_TOUR` in `src/data/demoTour.ts`, driven by the non-persisted `useTourStore` and `TourBar`) walks evaluators through Vibe-to-Vision intake, concept selection, Budget Guardian decor upgrades, guest count scaling (80 to 110), Chaos Lab rain recovery, and the final event checklist:
- **Zero Auto-Approval**: Running a tour chat step only sends the scripted host message through `ChatProvider.send` to display the resulting proposal card. It **never** calls `approveAndApply` on the user's behalf.
- **Explicit Guidance**: After each chat step runs, `TourBar` surfaces the reminder: *"Now review the proposal and approve it yourself. Momently never applies a change on its own."*
- **Resilient Offline Fallback**: Step 1 attempts `/api/intake` and gracefully falls back to `store.createDemoEvent()` if offline.

### Chat Log Accessibility Decisions

- **`role="log"` with `aria-live="off"`**: Interactive outcome cards contain headings, comparison tables, radio groups, and buttons. Allowing `aria-live` on the scroll container to read entire outcome subtrees would flood screen readers with verbose markup. Instead, `MessageList` sets `aria-live="off"` and `ChatProvider` announces only the concise plain-text summary (`outcomeToText`) through the polite `LiveRegionProvider`.
- **Visually Hidden Sender Labels**: Every message bubble prefixes a screen-reader-only label (`"You said:"` or `"Momently said:"`) so assistive technology users can distinguish turns without relying on visual alignment or bubble color.
- **Keyboard & Focus Ergonomics**: `Enter` submits, `Shift+Enter` inserts a newline, the 500-character counter announces only at 80%/90%/100% thresholds, focus returns to the composer textarea after sending, and the mobile bottom-sheet `Drawer` traps focus and restores it to the floating trigger on `Escape`.

---

## 17. Chaos Simulation Lab

Momently's Chaos Simulation Lab (`/events/[id]/chaos`, `src/components/chaos/`, `src/engine/chaos/`) enables hosts to stress-test their celebrations against real-world disruptions before reality does.

### The Simulation Principle: Read-Only, Pure & Offline
Every chaos simulation executes locally in Momently's pure deterministic engine with zero network latency and complete offline capability:
- **Zero Involuntary Mutations**: Running a simulation evaluates scenario impact against deep-frozen copies of the plan without altering active state or incrementing `plan.version`.
- **Pure Calculation**: Baseline scenario parameters are computed via `defaultInputFor`, verified through `chaosScenarioInputSchema`, and evaluated purely via `simulateScenario`.
- **No Hallucinations or Vendor Outreach**: Simulations rely strictly on empirical rate cards and local business rules. Momently never contacts vendors or invents prices.

### The Recovery Proposal Principle: Host Approval Gate
Disruptions produce structured `RecoveryOption` proposals with concrete trade-offs, line-item diffs (`previewOption`), and required approvals:
- **Host Consent Required**: Simulating NEVER mutates the active plan; only host approval through `useApproveOption` and `store.approveAndApply` commits changes to the ledger.
- **Budget Feasibility & Funding**: Recovery options that exceed the hard budget cap cannot be directly approved (`disabled` with clear rationale) and attach interactive `fundingOptions` from Budget Guardian.
- **Staleness Isolation**: If the plan version advances while an outcome is displayed, proposal cards automatically dim as stale, preventing outdated patch applications.

### Transparent Chaos Score: Points-Based Risk Sum
The Chaos Score (0–100) measures event resilience across four descriptive bands (`calm`, `manageable`, `exposed`, `fragile`):
- **Transparent Rule Sum**: The score is an arithmetic sum of transparent, explainable risk rules (e.g. uncovered venue in monsoon, razor-thin budget margin, tight schedule buffer, unverified price estimates)—not a black-box AI prediction.
- **Auditable Breakdown**: Hosts can inspect the exact point contribution and weight origin of each active risk rule in a dedicated calculations table.

### Full Stress Test Runner
The stress test runner (`runStressTest`) systematically evaluates the entire scenario catalog against the active plan:
- **Deterministic Catalog Execution**: Simulates all 6 scenarios in catalog order (`rain`, `budget_cut`, `guest_surge`, `vendor_cancels`, `late_start`, `item_unavailable`) using baseline defaults.
- **Weakest-Spot Identification**: Identifies the event's most critical vulnerability—prioritizing the first applicable scenario that fails the budget cap, or the scenario with the largest positive cost delta.
- **One-Click Deep-Linking**: Evaluators can open any scenario directly in the interactive simulator via `?scenario=<type>`, pre-selecting parameters and auto-simulating.

## 18. Timeline and Checklist

Momently's schedule and checklist architecture (`/events/[id]/timeline`, `/events/[id]/checklist`, `src/components/timeline/`, `src/components/checklist/`, `src/engine/taskDates.ts`, `src/engine/taskProgress.ts`, `src/engine/taskStatus.ts`, `src/engine/scheduleView.ts`, `src/engine/delayOptions.ts`) coordinates chronological milestones and operational action items.

### The Progress Versus Decision Distinction
A core architectural invariant separates milestone execution from plan design:
- **Progress Tracking (`setTaskStatus`)**: Checking off a task (`todo` -> `doing` -> `done`) represents operational progress by the host, NOT a structural plan decision. `setTaskStatus` updates `task.status` and `plan.updatedAt` purely, but strictly **never increments `plan.version`** or appends to `plan.ledger`. Bumping the plan version on simple checklist ticks would falsely invalidate concurrently open assistant proposals, chaos simulations, and funding levers as "stale", forcing annoying re-evaluations for unrelated task checkboxes.
- **Plan Decisions (`useUserEdit`)**: In contrast, modifying task content (`add_task`, `update_task`, `remove_task`) or modifying schedule slots (`add_slot`, `update_slot`, `remove_slot`, `shift_schedule`) represents structural design decisions. These operations advance through the validated `useUserEdit` and `approveAndApply` path, incrementing `plan.version` and appending to the decision ledger.

### Shared Delay-Option Logic (Timeline & Chaos Lab)
Both the host Timeline (`DelayPlanner`) and the Chaos Lab (`late_start` scenario) share identical delay resolution triage via `src/engine/delayOptions.ts`:
- **Three Deterministic Strategies**: When a session is delayed, `proposeDelayOptions` formulates three recovery paths:
  1. *Push everything back* (`cascade`): shifts all subsequent slots later in the timeline.
  2. *Squeeze to finish on time* (`absorb`): compresses flexible slots down toward their `minDurationMinutes`.
  3. *Swap two activities* (`swap`): exchanges the delayed slot with an adjacent flexible session.
- **Overtime Transparency**: If an option overruns the schedule boundary (`overflowMinutes > 0`), Momently attaches an explicit notice: `"Overtime of N minutes: confirm overtime rates with the venue, caterer, photographer and DJ; no prices are assumed"`.
- **Ranking & Host Autonomy**: Feasible options with the lowest disruption score appear first. Infeasible options remain visible for evaluation but are clearly flagged. As always: *"Momently suggests; you decide. It never contacts vendors or guests: you do that yourself."*

### The Midnight Rule (Boundary Invariant)
Schedule slots represent times within a single operational celebration day (00:00 to 24:00, or 0 to 1440 minutes since midnight). Both `add_slot` and `update_slot` strictly enforce:
$$\text{startMinute} + \text{durationMinutes} \le 1440$$
Any session attempting to run past midnight is rejected with typed error code `'schedule_overflow'` and the plain-English message `"A session can't run past midnight"`.

### The Print Run Sheet
On the day of the event, hosts and coordinators need high-contrast, physical run sheets:
- **Print Stylesheet Integration**: The `@media print` rules hide navigational chrome, side docks, and adjustment controls (`[data-print-hide]`, `.no-print`).
- **Clean Run-of-Show Layout**: Renders an exclusive print-only header with the event title and celebration date, followed by the complete chronological milestone sequence with start and end times, priority indicators, and host notes.

## 19. Event-Day Mode

Momently's Event-Day Mode (`/events/[id]/day-of`, `src/components/eventday/`, `src/engine/eventDay.ts`, `src/lib/time.ts`) acts as a calm, phone-first coordinator on celebration day. It displays what is happening now and up next, open checklist action items, quick emergency contacts, and real-time contingency options.

### Live Versus Practice Mode (Why Practice Exists)
Event coordinators and hosts cannot wait until the live celebration begins to verify their timeline pacing:
- **Practice Mode**: Available at any time during planning. Hosts can simulate any minute of the day using standard time inputs or `-15 min` / `+15 min` nudge buttons. Practice mode defaults to 30 minutes before the first scheduled session (`max(0, firstStart - 30)`), allowing coordinators to walk through door opening, session transitions, and wrap-up states prior to the event.
- **Live Mode**: Unlocked exclusively on the actual calendar day of the celebration (`isEventToday(plan, clock)` in local time). Live mode ticks every 30 seconds via pure clock injection, tracking active sessions, minutes remaining, and upcoming transitions in real time.
- **Polite Screen Reader Announcements**: To avoid auditory chatter, announcements trigger strictly when the active or upcoming activity changes (e.g. `"Now: Dinner. Next: Speeches at 8:30 PM"`), never on periodic clock ticks.

### Contacts Privacy by Construction
On-site coordinators need fast access to personal phone numbers for caterers, venue managers, photographers, and family members. Momently enforces strict privacy by construction:
- **Storage Isolation**: Contacts (`src/domain/contactSchemas.ts`) are stored in `EventRecord.contacts` on the client. They are strictly **omitted from `eventPlanSchema`**.
- **Zero Server or LLM Exposure**: Because contacts live outside the `EventPlan` entity, neither `slimPlanForRequest` nor `apiClient` payloads (`sendMessage`, `requestConcepts`) can ever access or serialize contact records. Similarly, `summarizePlanForLlm(plan)` never accesses contacts.
- **Reference Data (No Version Bump)**: Contact actions (`addContact`, `updateContact`, `removeContact`) update client-side reference records without incrementing `plan.version` or recording ledger entries, ensuring zero interference with concurrently active plan proposals.

### The Suggest-Never-Act Rule
In high-stress celebration moments, automated AI actions create panic. Momently strictly adheres to the principle of sovereign host control:
- **No Autonomous Outreach**: Momently provides direct `tel:` links and convenient clipboard copying for phone numbers, but never sends automated texts or emails to vendors or guests.
- **No Involuntary Plan Adjustments**: When sessions run late, the integrated `DelayPlanner` formulates concrete recovery options, but no changes are applied until the host explicitly clicks to approve. Every contingency screen prominently displays: *"Momently suggests; you decide. It never contacts vendors or guests: you do that yourself."*

### Screen Wake Lock (Progressive Enhancement)
Event hosts frequently check the run of show while walking across venues:
- **Feature Detection**: The `KeepScreenOn` component checks for `'wakeLock' in navigator`. Unsupported browsers render nothing, degrading gracefully.
- **Lifecycle Management**: Acquires a screen sentinel when toggled, safely re-requests the lock when returning from background visibility (`visibilitychange`), and automatically releases the sentinel on unmount or toggle off.
- **Non-Throwing Resilience**: Rejections due to system battery-saver mode or browser security policies display an inline status warning and never throw or crash the UI.

## 20. Guests and Vendors

Momently treats guest hospitality and vendor selection as high-stakes personal coordinator decisions, governed by strict privacy isolation and deterministic, evidence-only analysis.

### Privacy Design (Zero PII, Counts Only)
Celebration hosts manage intimate guest demographics and sensitive vendor communications:
- **Demographics as Aggregate Counts**: Guest hospitality requirements (`src/domain/baseSchemas.ts`, `GuestNeeds`) are modeled strictly as anonymous counts (vegetarians, Jain, vegans, gluten-free, allergy alerts, wheelchair users, elderly, children, quiet space) and languages. No guest names, email addresses, or phone numbers are ever stored in the plan.
- **Vendor Quotes Isolated from AI**: While vendor category status (`not_started`, `comparing`, `booked`) is summarized for LLM context, `summarizePlanForLlm(plan)` strictly strips all vendor quotes, vendor business names, prices, and answer text. The AI never sees commercial terms or candidate vendor identities.
- **Inquiry Brief Excludes Budget**: The host-facing inquiry brief (`src/lib/vendorBrief.ts`) compiles event metadata, requirements, and screening questions into plain text for hosts to send directly to vendors. To protect the host's negotiation leverage, the brief **never includes the budget, budget cap, contact names, or host notes**.

### Evidence-Only Comparison (No Invented Ratings or Scores)
Unlike commercial lead-generation platforms, Momently does not maintain vendor affiliate networks, sponsored rankings, or speculative quality scores:
- **Factual Analysis Only**: `compareQuotes` (`src/engine/quoteComparison.ts`) evaluates only the data the host explicitly inputs: quoted price, answered questions count, question completeness percentage, and percentage variance against the allocated budget line.
- **Transparent Observations**: Observations highlight factual gaps and math (e.g. *"The lowest price (₹X) hasn't answered N of your questions: ask before paying"*, *"Vendor is more than 40% away from your budget line: check what's included"*).
- **Explicit Fixed Disclaimer**: The UI explicitly informs hosts: *"Based only on what you entered. Momently has no vendor ratings, reviews or availability data, and doesn't invent any."*

### Quote to Budget Path with Provenance Tracking
When a host selects a quote, `quoteToBudgetOps` (`src/engine/quoteToBudget.ts`) provides a single, audited write-path directly into the active plan budget:
- **Locked Line Protection**: If the target budget item is locked by the host, the engine immediately rejects the change with an explicit instruction: *"Unlock this budget line first"*.
- **Provenance Integrity**: If the host checks *"This is a confirmed written quote"*, the budget item provenance is marked as `'verified'`. Otherwise, it is marked as `'user'`.
- **Hard Cap Interception**: Applying a quote routes through `useUserEdit`. If the quote pushes the overall plan beyond a hard budget cap, the mutation is blocked and converted into an approvable funding rebalance option.



