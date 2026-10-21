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

## 5. Security

<!-- To be filled as features land -->

---

## 6. Efficiency

<!-- To be filled as features land -->

---

## 7. Accessibility

<!-- To be filled as features land -->

---

## 8. Testing

<!-- To be filled as features land -->

---

## 9. Engine Overview

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
