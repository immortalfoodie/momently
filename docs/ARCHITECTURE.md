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

## 11. Accessibility & Design

<!-- To be filled as UI lands -->

---

## 12. Testing & Quality Standards

<!-- To be filled as UI lands -->

