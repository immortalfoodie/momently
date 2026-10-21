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

### Assistant Orchestration

The assistant engine (`src/engine/assistant/`) provides the pure, non-mutating bridge between validated LLM extractions and approvable engine proposals:

```text
User Text -> LLM (intent task) -> IntentOutput -> resolveIntent -> AssistantOutcome (proposal) -> User Approval -> applyPatch
```

- **Intake Synthesis (`fromIntake.ts`)**: Converts structured briefs into an initialized `EventPlan`. Every default (e.g. 50 guests, tier-2 city pricing, undecided setting) is explicitly recorded in `assumptions`, and past dates relative to the reference date are omitted.
- **Concept Operations (`concepts.ts`)**: Applies concept quality profiles (`selectConceptOps`), computes true previewed totals with dynamic contingency (`priceConcept`), and supports hybrid combination with target savings (`combineConcepts`).
- **Intent Resolution (`resolveIntent.ts`)**: Dispatches all 18 intent kinds through focused pure resolvers without side-effects. Conflicting requests return structured conflict explanations and funding paths rather than silent compromises.
- **Approvable Proposals**: Nothing in the assistant layer directly mutates plan state. Every actionable response is returned as an approvable `RecoveryOption` (source `'user'`), maintaining the strict invariant: *LLM proposes, engine decides, user approves*.

---

## 6. Security

### Prompt Injection & Untrusted Data Boundaries
All user input is treated strictly as data, never as prompt instructions. Inputs are sanitized (`sanitizeUserText`) via NFKC Unicode normalization, control character stripping, whitespace trimming, and hard length truncation. Inputs are wrapped in `<user_text>` XML data boundaries with internal delimiter escaping (`wrapUntrusted`). Potential injection attempts are proactively flagged (`detectInjectionAttempt`) via heuristic pattern inspection.

### Schema-Validated Output
No raw LLM text is ever passed downstream. Completions must extract a balanced JSON object and parse cleanly against Zod schemas. On failure, a single-shot correction prompt is issued referencing only the schema issue paths and messages, explicitly avoiding echoing untrusted model output.

### Server-Only Enforcement
Client-side components and state stores (`src/components/**`, `src/store/**`) are forbidden by ESLint `no-restricted-imports` from importing `geminiProvider` or provider `factory`. All LLM communication is gated behind server-side API routes, preventing client-side API key leakage or SDK bundling.

### Privacy and Zero-Logging Policy
Prompts, model responses, and raw user briefs are never logged to console or disk. Injected plan summaries strip all personal identifiers, exposing only aggregate headcount numbers. Error handlers scrub all internal messages to guarantee that API keys, prompt instructions, and user texts never leak into logs or client error payloads.

---

## 7. Efficiency

<!-- To be filled as features land -->

---

## 8. Accessibility

<!-- To be filled as features land -->

---

## 9. Testing

<!-- To be filled as features land -->

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
