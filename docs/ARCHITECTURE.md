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
