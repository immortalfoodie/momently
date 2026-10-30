# Momently: Complete Feature Guide

This guide explains everything Momently does and how each feature works under the hood. It is written for anyone who wants to understand the product end to end: teammates, reviewers and judges.

For deep engineering detail (security controls, design tokens, test strategy), see [ARCHITECTURE.md](ARCHITECTURE.md). For deployment, see [DEPLOY.md](DEPLOY.md).

---

## Contents

1. [What Momently is](#1-what-momently-is)
2. [Three rules that every feature follows](#2-three-rules-that-every-feature-follows)
3. [The journey at a glance](#3-the-journey-at-a-glance)
4. [Vibe-to-Vision intake](#4-vibe-to-vision-intake)
5. [Concept Studio](#5-concept-studio)
6. [The living plan: overview, propagation and version history](#6-the-living-plan-overview-propagation-and-version-history)
7. [Budget and the Budget Guardian](#7-budget-and-the-budget-guardian)
8. [Conflict detection](#8-conflict-detection)
9. [The chat assistant](#9-the-chat-assistant)
10. [Chaos Lab](#10-chaos-lab)
11. [Timeline and delay planner](#11-timeline-and-delay-planner)
12. [Checklist](#12-checklist)
13. [Guests](#13-guests)
14. [Vendors and the Vendor Decision Coach](#14-vendors-and-the-vendor-decision-coach)
15. [Event Day mode](#15-event-day-mode)
16. [Event Kit and exports](#16-event-kit-and-exports)
17. [Settings, AI mode and your data](#17-settings-ai-mode-and-your-data)
18. [Guided demo tour](#18-guided-demo-tour)
19. [How the AI layer works](#19-how-the-ai-layer-works)
20. [Security and privacy](#20-security-and-privacy)
21. [Accessibility](#21-accessibility)
22. [Performance and efficiency](#22-performance-and-efficiency)
23. [Testing](#23-testing)
24. [Glossary](#24-glossary)

---

## 1. What Momently is

Momently is a GenAI planning assistant for weddings, birthdays, anniversaries and community events, built for everyday hosts in India. A host describes the celebration in their own words, for example:

> "I want to celebrate my parents' 25th anniversary in Mumbai. Around 80 guests, budget ₹1.5 lakh. They love old Bollywood songs, elegant decorations, and good food."

Momently turns that into a complete plan: three creative concepts, a priced budget that respects the cap, a run-of-show, a checklist, vendor requirements, guest-care notes and a day-of coordinator. It then keeps the plan consistent as things change, and stress-tests it against things going wrong.

**Tech stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand (state), Zod (validation), Google Gemini through `@google/genai` (live AI), Vitest with Testing Library and axe-core (tests).

---

## 2. Three rules that every feature follows

Every feature below is built on these three rules. They are what make the product trustworthy.

### Rule 1: The AI proposes, the engine decides

The language model is good at understanding language and bad at arithmetic. So Momently splits the work:

| The AI does | The engine (plain TypeScript) does |
|---|---|
| Reads the host's story and extracts facts | Every price, total and percentage |
| Invents creative concepts and explains why they fit | Budget caps, contingency, guest scaling |
| Works out what a chat message is asking for | Schedule maths, conflicts, risk score |
| Turns a free-text disaster into typed scenarios | Simulates disasters and prices recoveries |
| Writes friendly explanations from verified facts | Decides which facts exist |

The engine lives in [`src/engine/`](../src/engine). Its functions are pure: same input, same output, no side effects, and they never modify the plan passed in.

### Rule 2: Nothing changes without the host's approval

Every change (from chat, Chaos Lab, Budget Guardian or a concept switch) becomes a **proposal** first. A proposal shows:

- exact line-item changes (before and after),
- the new total and whether it fits the cap,
- the Chaos Score before and after,
- what the host is agreeing to ("You'd be approving: …").

Only when the host clicks **Approve this change** does the plan update. If the change would break a hard budget cap, the Approve button is disabled and Momently offers ways to fund it instead.

### Rule 3: The plan stays on the host's device

Plans are stored in the browser (`localStorage`), not on a server. The server is stateless: the browser sends the plan with each AI request, the server validates it, answers, and forgets it. Private details such as phone numbers never leave the device.

### Demo mode and live mode

- **Demo mode** (default, no API key): every AI task is answered by a built-in offline engine in [`src/llm/mock/`](../src/llm/mock). Every feature works.
- **Live mode** (`LLM_PROVIDER=gemini` plus a key): Gemini answers. If Gemini fails, times out or returns invalid output, Momently falls back to the offline engine automatically and marks the answer as "degraded".

The header badge always shows **Live AI** (with the model name) or **Demo mode**.

---

## 3. The journey at a glance

```text
Describe your celebration  ─►  3 concepts  ─►  Pick one  ─►  Refine (chat, budget tools)
        │                                                          │
        ▼                                                          ▼
  Plan created with                                       Every change = proposal
  budget, schedule, tasks                                 ─► preview ─► fund if needed ─► approve
                                                                   │
                                                                   ▼
                       Chaos Lab stress test  ─►  Event Kit exports  ─►  Event Day mode
```

---

## 4. Vibe-to-Vision intake

**Where:** `/new`, or the assistant panel on any non-event page.
**Code:** [`src/components/intake/`](../src/components/intake), [`src/server/handlers/intake.ts`](../src/server/handlers/intake.ts), [`src/engine/assistant/fromIntake.ts`](../src/engine/assistant/fromIntake.ts), [`src/engine/planFactory.ts`](../src/engine/planFactory.ts).

### What it does

The host types a free-form description in English, Hindi or Hinglish (up to 1,500 characters). Momently creates a complete starter plan.

### How it works

1. **Clean the text.** The server normalises Unicode, strips control characters and trims length ([`sanitize.ts`](../src/llm/sanitize.ts)). The text is wrapped in `<user_text>` tags, and the AI is told that everything inside is data, never instructions.
2. **Extract facts (AI task `intake`).** The AI returns a validated JSON object: event type, city, date, guest count, budget, indoor/outdoor setting, style preferences, must-haves and things to avoid. It also lists **missing information** instead of guessing.
3. **Fill gaps with recorded assumptions.** Anything missing gets a sensible default (for example 50 guests, tier-2 pricing, setting "undecided"). Each default is written into an **assumptions** list that the host sees on the "What I assumed" card. Dates in the past are dropped.
4. **Price the plan.** The plan factory picks the event-type template (wedding, birthday, anniversary, community) and prices every line from the rate cards:
   - **City tier multiplier:** tier 1 (Mumbai, Delhi, Bengaluru and other metros) ×1.0, tier 2 ×0.8, tier 3 ×0.65.
   - **Guest bands:** flat items such as the venue step up in price at 50, 100, 150, 250 and 500 guests.
   - **Per-guest items:** catering scales with headcount, plus a 5% food buffer.
   - **Contingency reserve:** a percentage that depends on event type and setting (outdoor and mixed events get more).
5. **Fit the cap.** If the total exceeds a hard budget cap, the factory steps items down in the template's downgrade order until it fits. It then reports a **fit report**: whether it fits, the total, the cap, and which items were downgraded.
6. **Create tasks, schedule and vendor needs** from the template.
7. **Generate concepts** (see next section) and open the Concept Studio.

If the server is unreachable, the demo tour falls back to a locally built demo plan, so the journey never dead-ends.

---

## 5. Concept Studio

**Where:** `/events/[id]/concepts`.
**Code:** [`src/components/concepts/`](../src/components/concepts), [`src/engine/assistant/concepts.ts`](../src/engine/assistant/concepts.ts), [`src/engine/assistant/combineConcepts.ts`](../src/engine/assistant/combineConcepts.ts).

### What it does

Shows three genuinely different directions for the same celebration, for example *Vintage Bollywood Evening*, *Elegant Golden Celebration* and *Memory Lane*. Each card shows a cover illustration, colour palette, highlights, trade-offs, "Why it fits you", and a live price against the cap.

### How it works

1. **AI task `concepts`** writes exactly three concepts: lean, balanced and signature. Each comes with a **quality profile**: which rate-card families should be essential, standard or premium (for example premium décor, standard catering).
2. **The engine prices each concept live** (`priceConcept`): it applies the quality profile to a preview copy of the plan and recomputes the total, including contingency. Prices update immediately when guests or city change; they are never stale stored numbers.
3. **The progress bar** shows the total against the cap and says "Over cap by ₹X" or "₹X to spare" in words, not just colour.
4. **Choosing a concept** creates a proposal that switches every line to that concept's quality levels. The host approves it like any other change.
5. **Combining concepts.** In chat, the host can say *"Combine the decorations from option 2 with the atmosphere of option 1, but make it 20% cheaper."* The engine takes option 1 as the base, borrows the décor categories from option 2, then applies savings levers until the total is 20% lower, and returns one proposal.
6. **Cover art** is generated locally as layered SVG from a seed, so there are no external images or trackers.

---

## 6. The living plan: overview, propagation and version history

**Where:** `/events/[id]` (Overview) and the Plan Health Strip at the top of every event page.
**Code:** [`src/components/overview/`](../src/components/overview), [`src/components/plan/PlanHealthStrip.tsx`](../src/components/plan/PlanHealthStrip.tsx), [`src/engine/propagate.ts`](../src/engine/propagate.ts), [`src/engine/history.ts`](../src/engine/history.ts).

### Overview page

Shows event facts (editable), the chosen concept, open conflicts, top risks, next steps, a "forgotten costs" teaser and the version history.

### Plan Health Strip

A sticky bar on every event page: budget used against the cap, a "Near budget cap" or "Over cap" warning, Chaos Score and band, conflict count and plan version. Each status uses an icon and words, never colour alone.

### How a single change ripples through the plan (propagation)

When the guest count changes from 80 to 110:

1. **Per-guest items** (catering, favours) recalculate from the new headcount.
2. **Banded items** (venue) move to the right guest band.
3. **Contingency** is recomputed from the new subtotal.
4. **Locked items** and items whose price the host entered or verified are **not repriced**. Only estimates move.
5. The proposal lists every changed line and the new total.
6. If the result breaks a hard cap, Momently offers two kinds of option: rebalance quality to stay under the cap, or raise the cap. It never silently overspends.

The same propagation runs when the city changes (new tier multiplier).

### Version history

- Every approved change appends a **decision record** to the plan's ledger (up to 500) and increments the **version number**.
- A **snapshot** of the plan before each change is kept (up to 25 per event).
- The host can compare any old version with the current one, and **restore** it. Restoring never deletes history: it creates a new version that copies the old one and logs "Restored version N".

### Stale proposal protection

Each proposal remembers the version it was built against. If the plan has changed since then (say, the host edited guests manually), that proposal is dimmed with an "Out of date" badge and cannot be approved. This prevents an old suggestion from overwriting newer edits.

### Event stage

The plan's stage (draft, planning, completed) is derived from its state and the date, not stored, so it can never drift out of sync.

---

## 7. Budget and the Budget Guardian

**Where:** `/events/[id]/budget`.
**Code:** [`src/components/budget/`](../src/components/budget), [`src/engine/budget.ts`](../src/engine/budget.ts), [`src/engine/guardian.ts`](../src/engine/guardian.ts), [`src/engine/levers.ts`](../src/engine/levers.ts), [`src/engine/impactRebalance.ts`](../src/engine/impactRebalance.ts), [`src/engine/forgottenCosts.ts`](../src/engine/forgottenCosts.ts), [`src/engine/budgetFacts.ts`](../src/engine/budgetFacts.ts).

All money is stored as whole rupees (integers), so there are no rounding errors.

### Budget at a glance

Total, cap, remaining amount and percentage used. The host can edit the cap and choose whether it is **hard** (never exceed) or **flexible**.

### Where the money goes

- **Category breakdown:** venue, food, décor, photography, entertainment, transport, gifts, contingency and other.
- **Provenance breakdown:** how much of the budget is an *estimate*, *your input* or a *verified quote*.

### Line items, provenance and locks

Every line shows where its price came from:

| Provenance | Meaning | Repriced automatically? |
|---|---|---|
| Estimate | From Momently's rate cards | Yes, when guests or city change |
| Your input | The host typed the price | No |
| Verified quote | A confirmed written quote from a vendor | No |

Hosts can also **lock** any line. Locked lines are never changed by savings, rebalancing or chaos recovery.

### Safe editing

When the host edits, adds or removes a line:

1. The engine previews the change without saving it.
2. If it stays within the cap, it is saved and announced ("Saved. Budget now ₹X.").
3. If it would break a hard cap, the edit is **not** applied. Momently instead builds a proposal with funding options that protect the item just edited.

### Explain my budget

A button that asks the AI for a plain-English summary. The engine first computes a small set of facts (total, cap, amount over or under, cost per guest, top five categories, share of estimates versus quotes, locked count). The AI may only use those numbers. In demo mode, a template narrator writes the same summary. If the request fails, the page says the numbers on screen are unaffected.

### Budget Guardian tools

All of these run locally in the browser, with no AI and no network:

| Tool | Host asks | How it works |
|---|---|---|
| **Affordability check** | "Can we fit a live singer?" | Prices the item from rate cards (or uses the host's price), adds it to a preview, and reports the new total against the cap. If it doesn't fit, it proposes funding options. |
| **Target savings** | "Where can I save ₹15,000?" | Lists every saving lever (step an item down one quality level, or remove an optional item), skips locked items, ranks levers from least to most noticeable to guests, then builds up to three strategies: **Least noticeable**, **Fewest changes** and **Protect the experience**. |
| **Quality upgrade** | "Upgrade the décor but keep the budget fixed" | Upgrades the item, and if that breaks the cap, attaches funding strategies that never touch the upgraded item. |
| **Make it feel expensive** | "Make it look premium without spending more" | Moves money from low-visibility items (guest transport, favours, stationery) into high-impact ones (décor, music, photography) so the event feels more lavish at the same total. |
| **Forgotten costs** | "What am I forgetting?" | Checks the plan for commonly missed items: weather cover, venue deposit and overtime terms, catering taxes and service staff, music licensing (PPL/IPRS), photography overtime and albums, décor setup and teardown labour, valet parking, a children's area, accessibility ramps and staff, tips. Each comes with a reason. |
| **What-if guests** | "What if 20 more guests come?" | Runs the guest-count propagation as a preview and shows both holding the cap and raising it. |

### How funding works

When a proposal would exceed a hard cap, the host sees "Choose how to fund it". Picking a strategy merges the proposal with the strategy's savings into one change. If both touch the same item, the later change wins. The impact is then recalculated, so the host approves one coherent change that fits the cap.

---

## 8. Conflict detection

**Code:** [`src/engine/conflicts.ts`](../src/engine/conflicts.ts), [`src/engine/conflictRules.ts`](../src/engine/conflictRules.ts), [`src/engine/feasibility.ts`](../src/engine/feasibility.ts).

Momently scans the plan for problems and pairs each one with ways to fix it:

| Conflict | Example | Fix options offered |
|---|---|---|
| Cap below the essential floor | ₹40,000 cap for 200 guests in Mumbai | Raise the cap, reduce guests, or relax requirements |
| Cap exceeded | Total ₹1,62,000 against a ₹1,50,000 hard cap | Savings strategies or raise the cap |
| Guest limit exceeded | 110 guests against a stated 100-guest limit | Raise the limit or reduce guests |
| Monsoon outdoor | Outdoor event in June to September with no cover | Add weather cover, or move indoors |
| Must-have missing | Host said "live music is a must" but none is budgeted | Add the item |
| Accessibility unconfirmed | Wheelchair users expected, step-free route not confirmed | Add a "confirm accessible route" task |

Blocking conflicts and warnings are labelled in words ("Blocking conflict" or "Plan warning"). When a request would create a new conflict, the assistant **asks which constraint to relax** instead of silently complying.

---

## 9. The chat assistant

**Where:** the Assistant panel (docked on the right on wide screens, a drawer on smaller ones).
**Code:** [`src/components/chat/`](../src/components/chat), [`src/server/handlers/message.ts`](../src/server/handlers/message.ts), [`src/engine/assistant/`](../src/engine/assistant).

### Two modes

- **Intake mode** (outside an event): the message is treated as a new celebration brief.
- **Event mode** (inside `/events/[id]`): the message is a request about the current plan.

### What it understands

18 kinds of request, including: change guest count, change budget, adjust a category by a percentage, upgrade or downgrade an item, save a specific amount, "can we afford…", find forgotten costs, make it premium, simulate a disaster, choose a concept, combine concepts, add a preference (dietary, accessibility, style, must-have, avoid), set indoor/outdoor, set the date, plus answer, clarify or decline.

### How a message is handled

1. The browser sends the message, the last six chat turns (each cut to 300 characters) and a slimmed plan (only the 20 most recent ledger entries).
2. The server validates everything with Zod. A tampered plan (negative prices, oversized lists) is rejected before reaching the AI.
3. **AI task `intent`** classifies the message into a typed request.
4. **The engine resolves it** into an outcome: a proposal, a conflict with options, information, a chaos result, a clarifying question or a reply.
5. The panel shows the outcome as interactive cards. Nothing changes until the host approves.

### Several requests in one message (compound requests)

Hosts often ask for several things at once, for example:

> "Save ₹10,000 and tell me what happens if the photographer cancels."

How it works ([`resolveSteps.ts`](../src/engine/assistant/resolveSteps.ts)):

1. The AI may return up to **three ordered steps** instead of one request.
2. **Clash check first.** If two steps contradict each other (two different guest counts, or upgrading and downgrading the same item), Momently asks which one the host means instead of guessing.
3. **Each step runs against a draft.** Step 2 sees the plan as it would look after step 1, and so on. The stored plan is never touched.
4. Each step is labelled:
   - **In proposal:** a change that will be applied on approval.
   - **Checked:** a read-only result, such as a simulation or an answer.
   - **Not done:** with the reason (for example, the step needed clarification).
5. All planned changes are merged into **one proposal**, re-checked against the hard cap, with funding options attached if needed.
6. The host sees a numbered **"What I'll do"** list followed by a single Approve button.

The offline mock splits messages on "and" (only when followed by an action word such as "what", "add" or "save"), "then", "also" and commas. Commas inside numbers like ₹10,000 never split.

### Narration

When the assistant runs a simulation, it can add a short plain-English summary written from engine facts only.

### Memory and reloads

Chat messages are saved as short text summaries. Interactive proposal cards live only in memory, because saving them could bring back stale changes after a reload. After a reload, the panel notes that suggestions expire and the host can simply ask again.

---

## 10. Chaos Lab

**Where:** `/events/[id]/chaos`.
**Code:** [`src/components/chaos/`](../src/components/chaos), [`src/engine/chaos/`](../src/engine/chaos), [`src/engine/risk.ts`](../src/engine/risk.ts).

Chaos Lab stress-tests the plan before the real day. It has five parts.

### 10.1 Chaos Score

A transparent 0 to 100 vulnerability score, the sum of points from clear rules. It is not a prediction. Rules include:

- Open-air venue without rain protection (more points during the monsoon)
- Budget cap exceeded, or a razor-thin margin
- Contingency reserve below the recommendation
- Guests exceed venue capacity
- Tight schedule with too little buffer
- Event date undecided
- Critical vendors unbooked close to the date
- High share of unverified price estimates
- Accessibility arrangements unconfirmed

The score falls into four bands: **Calm** (0–24), **Manageable** (25–49), **Exposed** (50–74) and **Fragile** (75–100). A breakdown table shows exactly how many points each rule contributes.

### 10.2 Describe your own disaster (free text)

The host types a problem in their own words, for example *"Heavy rain and the photographer just cancelled"*, or Hinglish such as *"baarish ho rahi hai aur sab 2 ghante late hai"*.

How it works:

1. **Send vocabulary, not the plan.** The browser sends only the text, the plan's vendor categories, its rate-card item families, the setting and the guest count ([`describe.ts`](../src/engine/chaos/describe.ts)).
2. **AI task `chaos_describe`** maps the story to up to three scenarios using only that vocabulary, writes one sentence restating the problem, and adds an honest note for anything it cannot simulate (illness, power cuts).
3. **The engine re-checks every scenario** against the real plan and drops any that:
   - name a vendor or item the plan does not have,
   - don't apply (rain at an indoor venue),
   - repeat a scenario type already found.

   Each dropped scenario is shown with its reason.
4. The first accepted scenario runs immediately. The host can switch between the problems found with numbered buttons.
5. Recovery works exactly like the picker below and needs approval.

The offline mock understands English and common Hinglish words ("baarish", "ghante", "nahi mil").

### 10.3 Simulate a problem (scenario picker)

Six scenarios, each with adjustable settings:

| Scenario | Setting | What the engine produces |
|---|---|---|
| **Rain hits the outdoor event** | none | Option A: weather cover (tent or canopy) priced from rate cards. Option B: hold a backup indoor hall on standby at 20% of the essential hall rate. |
| **Budget suddenly cut** | 5–60% | Lowers the cap and builds savings that protect the most important experiences. |
| **Guest count surge** | +1 to +1,000 guests | Rescales catering, seating and venue band, then holds or raises the cap. |
| **Key vendor cancels** | which vendor | A replacement checklist, re-quoting steps and recovery tasks. Notes that Momently never contacts vendors itself. |
| **Timeline running late** | 15–240 minutes | Delay recovery options (see the Timeline section): push back, squeeze, or swap. |
| **Key item out of stock** | which item | A substitute at a different quality level, or reallocation of the budget. |

Scenarios that don't apply are disabled with a reason (for example, rain is disabled for indoor venues).

**For every scenario:**

- Simulation never changes the plan or its version.
- Each recovery option shows its cost, line-item changes, Chaos Score before and after, and what the host must approve.
- The recommended option is the one that meets the cap with the lowest Chaos Score, then the lowest total.
- Options over a hard cap come with funding choices and cannot be approved directly.
- **Explain this in plain words** asks the AI to summarise the result from engine facts only.

### 10.4 Full stress test

Runs all six scenarios with sensible defaults in one click. It highlights the **weakest spot**: the first scenario that breaks the cap, or the one with the largest cost increase. Each row can be opened directly in the simulator.

### 10.5 Risk register

Lists every active risk with its points and explanation. Each risk links to the scenario that tests it.

---

## 11. Timeline and delay planner

**Where:** `/events/[id]/timeline`.
**Code:** [`src/components/timeline/`](../src/components/timeline), [`src/engine/schedule.ts`](../src/engine/schedule.ts), [`src/engine/delayOptions.ts`](../src/engine/delayOptions.ts), [`src/engine/scheduleDelay.ts`](../src/engine/scheduleDelay.ts).

### Run of show

An ordered list of sessions (welcome, dinner, speeches and so on). Each has a start time, a duration, a minimum duration if it can be shortened, and a priority (essential sessions are never cut). Times are stored as minutes since midnight, so there is no time-zone drift.

**The midnight rule:** a session cannot run past midnight. Momently rejects it with "A session can't run past midnight".

Momently also flags overlaps, gaps and missing buffers between sessions.

### Prep countdown

Shows how many days remain until the celebration.

### Delay planner

When a session runs late, Momently proposes three strategies:

1. **Push everything back:** shift every later session by the delay.
2. **Squeeze to finish on time:** shorten flexible sessions toward their minimum duration, and drop optional ones if needed.
3. **Swap two activities:** exchange the delayed session with a neighbouring flexible one.

Options are ranked by how disruptive they are. Options that are impossible remain visible but are flagged. If an option runs over the planned end, Momently warns: *"Overtime of N minutes: confirm overtime rates with the venue, caterer, photographer and DJ; no prices are assumed."*

The same logic powers Chaos Lab's "Timeline running late" scenario and Event Day mode.

### Print run sheet

Printing the timeline hides navigation and controls and produces a clean, high-contrast run sheet with times, priorities and notes.

---

## 12. Checklist

**Where:** `/events/[id]/checklist`.
**Code:** [`src/components/checklist/`](../src/components/checklist), [`src/engine/taskDates.ts`](../src/engine/taskDates.ts), [`src/engine/taskProgress.ts`](../src/engine/taskProgress.ts).

### What it does

Every task has a title, priority and "due N days before the event". Tasks are grouped into time windows:

- **Overdue**
- **3+ months before**
- **1 to 3 months before**
- **Final month**
- **Final week**
- **Event day**

Within each group, tasks are sorted by priority, then by how early they are due. Filters narrow the list by category and by status (to do, in progress, done). A progress meter shows how many are complete.

### How it works

- Due dates are calculated from the event date with pure calendar arithmetic, so they don't drift with the time zone.
- **Ticking a task off is progress, not a plan decision.** It updates the task's status without bumping the plan version, so it does not make open proposals "out of date".
- **Adding, editing or removing a task is a plan decision.** It goes through the normal change path and is recorded in history.
- Tasks are also created automatically by approved changes (for example, "confirm accessible route" or vendor re-quoting after a cancellation).

---

## 13. Guests

**Where:** `/events/[id]/guests`.
**Code:** [`src/components/guests/`](../src/components/guests), [`src/engine/guestInsights.ts`](../src/engine/guestInsights.ts), [`src/engine/guestMetrics.ts`](../src/engine/guestMetrics.ts).

### What it does

Thinks about the guests, not just the host. The host records **counts only** (never names): vegetarian, Jain, vegan, gluten-free, allergies, wheelchair users, elderly guests, children, guests needing a quiet space, and languages spoken.

### How it works

- **Meal plan table:** turns the counts into catering numbers, including the 5% buffer.
- **Seating:** works out tables at 8 seats per table.
- **Insights:** each relevant count triggers a specific recommendation and an optional task:
  - Wheelchair users → step-free access and accessible restrooms
  - Elderly guests → priority seating near the entrance and restrooms
  - Children → kids' menu and a child-safe activity area
  - Jain guests → separate kitchen preparation and buffet labelling
  - Vegan guests → plant-based items and cross-contact handling
  - Gluten-free guests → menu verification with the caterer
- **Access check:** flags when accessibility is expected but the route has not been confirmed.
- **Preferences manager:** stores dietary, accessibility, style, must-have and avoid preferences as hard or soft constraints that feed into conflict detection.
- **Privacy note:** the page explains that only counts are stored and nothing personal is sent to the AI.

---

## 14. Vendors and the Vendor Decision Coach

**Where:** `/events/[id]/vendors`.
**Code:** [`src/components/vendors/`](../src/components/vendors), [`src/engine/quoteComparison.ts`](../src/engine/quoteComparison.ts), [`src/engine/quoteToBudget.ts`](../src/engine/quoteToBudget.ts), [`src/lib/vendorBrief.ts`](../src/lib/vendorBrief.ts).

### What it does

Turns "find a photographer" into a better buying decision.

### How it works

1. **Vendor needs:** one card per category (venue, catering, photography and so on) with status: not started, comparing or booked.
2. **What to ask:** each category lists the questions to put to vendors. For photographers: hours of coverage, number of edited photos, delivery time, overtime charges, backup equipment and cancellation terms.
3. **Enter quotes:** the host records each quote: vendor name, price, and answers to the questions.
4. **Evidence-only comparison:** Momently compares only what the host entered: price, how many questions were answered, and how far each quote is from the budget line. It writes factual observations such as *"The lowest price (₹X) hasn't answered 2 of your questions: ask before paying"*. There are **no invented ratings, reviews or availability**, and the page says so.
5. **Use this quote:** writes the quote into the budget line. If the host ticks "This is a confirmed written quote", the line becomes *Verified quote*; otherwise *Your input*. Locked lines must be unlocked first. If the quote breaks a hard cap, it becomes a proposal with funding options.
6. **Inquiry brief:** a ready-to-send message with event details, requirements and screening questions. It deliberately **omits the budget**, so the host keeps negotiating leverage, and omits contacts and private notes.

The AI never sees vendor names, prices or quote text.

---

## 15. Event Day mode

**Where:** `/events/[id]/day-of`.
**Code:** [`src/components/eventday/`](../src/components/eventday), [`src/engine/eventDay.ts`](../src/engine/eventDay.ts).

### What it does

A calm, phone-first coordinator for the celebration itself.

### How it works

- **Now and Next:** shows the current session, minutes remaining and what comes next. Screen readers hear an announcement only when the activity changes, not on every clock tick.
- **Live mode** turns on only on the actual event date and updates every 30 seconds.
- **Practice mode** works any day. The host picks a time or nudges ±15 minutes to rehearse the flow. It starts 30 minutes before the first session.
- **Today's tasks:** open tasks due within a day, overdue tasks and high-priority items.
- **Contacts:** caterer, venue manager, family and so on, grouped by category with tap-to-call and copy buttons. Contacts are stored **outside the plan**, so they are never sent to the server or the AI and never appear in exports.
- **Problem solver:** "The cake is 30 minutes late" opens the delay planner with recovery options. Nothing is applied until the host approves.
- **Keep screen on:** uses the browser's Wake Lock where supported, so the phone doesn't sleep. Unsupported browsers simply don't show the toggle.
- **Suggest, never act:** every screen reminds the host that Momently never contacts vendors or guests.

---

## 16. Event Kit and exports

**Where:** `/events/[id]/kit` and `/events/[id]/kit/plan`.
**Code:** [`src/components/kit/`](../src/components/kit), [`src/lib/export/`](../src/lib/export).

Everything is generated in the browser. No export calls the server or the AI.

| Export | What it contains | How it is built |
|---|---|---|
| **Budget CSV** | Every line with category, quantity, cost and provenance | Numbers stay plain integers so spreadsheets can sum them; cells starting with `=`, `+`, `-` or `@` are neutralised against formula injection; a UTF-8 marker makes ₹ and Indic scripts display correctly in Excel |
| **Checklist CSV** | Tasks with due windows and status | Same safety rules |
| **Calendar (.ics)** | Every run-of-show session | Times are "floating" local times, so a 7 PM dinner shows at 7 PM wherever the calendar app is; long lines are folded without splitting multi-byte characters |
| **Printable plan** | Facts, concept, budget, schedule and tasks | Deliberately excludes phone numbers, the host's original private brief, and vendor names and quotes; every price shows its provenance and a disclaimer that estimates are not quotes |
| **Invitation copy** | Ready-to-edit invitation text | Deterministic template |
| **Vendor briefs** | One inquiry message per vendor category | Excludes the budget |
| **Order quantities** | Food and supply quantities | Calculated from guest counts and buffers |
| **JSON backup** | The full event | Re-importable from Settings |

Copying uses the clipboard, with a fallback dialog if clipboard access is blocked.

---

## 17. Settings, AI mode and your data

**Where:** `/settings`.
**Code:** [`src/components/settings/`](../src/components/settings), [`src/lib/export/backup.ts`](../src/lib/export/backup.ts), [`src/lib/useAiMode.ts`](../src/lib/useAiMode.ts).

### AI mode

Shows **Live AI** (with the model name), **Demo mode** or **Offline**, what is sent to the AI (the message and a compact plan summary of numbers and categories) and what is never sent (names, contacts, vendor quotes).

How it works: the header, assistant panel and settings all need this status. They share one in-flight `/api/health` request instead of sending three, and the answer is never cached after it arrives, so a changed mode is picked up next time.

### Your data

- **Back up:** downloads all events as a JSON file.
- **Restore:** imports a backup. The file is validated strictly: maximum size, correct format and version, and each event checked individually. Bad records are skipped and counted rather than failing the whole import. Imported events get fresh IDs, so nothing existing is ever overwritten. Chat messages are dropped. There is a maximum of 20 events per file and 50 in total.
- **Delete everything:** clears all events, chat, tour state and the stored data key.

### Resilient storage

If the browser blocks storage (private mode, quota full), Momently keeps working in memory and tells the host. Saved data is re-validated every time it loads. Corrupt events are skipped with a notice instead of crashing the app. If storage nears about 2.5 MB, the oldest history snapshots are pruned first; active plans are never dropped.

---

## 18. Guided demo tour

**Where:** **Watch the demo** on the home page.
**Code:** [`src/data/demoTour.ts`](../src/data/demoTour.ts), [`src/components/demo/TourBar.tsx`](../src/components/demo/TourBar.tsx).

An 8-step guided walkthrough of the anniversary example. Each step explains why it matters and what to look for.

| Step | What happens |
|---|---|
| 1. Vibe-to-Vision intake | The anniversary brief creates the plan and three concepts |
| 2. Pick Vintage Bollywood | A concept proposal appears for approval |
| 3. Upgrade décor, keep the budget | Budget Guardian funds the upgrade without touching décor |
| 4. Guests 80 → 110 | The plan rescales; compare holding against raising the cap |
| 5. What if it rains? | Chaos Lab rain recovery with a lower Chaos Score |
| 6. Two requests at once | "Save ₹10,000 and tell me what happens if the photographer cancels" shows the "What I'll do" list |
| 7. Describe your own disaster | Chaos Lab opens with "Heavy rain and the photographer just cancelled" pre-filled |
| 8. Event Kit and final checklist | The finished plan, ready to execute |

**The tour never approves anything.** It only sends the scripted message or navigates; the host clicks Approve themselves. Every step works in demo mode without an API key.

---

## 19. How the AI layer works

**Code:** [`src/llm/`](../src/llm), [`src/server/`](../src/server).

### The five AI tasks

| Task | Input | Output (validated) | Temperature | Timeout |
|---|---|---|---|---|
| `intake` | Host's story | Event facts, preferences, missing info | 0.1 | 15 s |
| `concepts` | Plan summary | Exactly 3 concepts with quality profiles | 0.7 | 20 s |
| `intent` | Message and plan summary | One request, or up to 3 ordered steps | 0.1 | 10 s |
| `chaos_describe` | Disaster text and allowed vocabulary | Up to 3 scenarios and an honest note | 0.1 | 10 s |
| `narrate` | Engine facts (max 30) | Up to 700 characters and 4 highlights | 0.4 | 10 s |

Low temperature is used for extraction (precision); higher for creative concepts.

### The pipeline for every AI call

```text
validate input ─► check cache ─► build prompt ─► call provider (1 retry on temporary errors)
      ─► extract JSON ─► validate output with Zod ─► if invalid: one correction retry
      ─► still failing? fall back to the offline mock (marked "degraded") ─► cache result
```

- **Prompt safety:** shared rules tell the AI that everything inside `<user_text>` is untrusted data. The AI must never invent prices, vendors, ratings or availability, never include personal data, and always answer as JSON only.
- **Cache:** identical requests reuse a validated answer instead of calling the AI again.
- **Fallback:** provider outages, timeouts, rate limits, safety blocks and invalid output all fall back to the offline mock, so the host is never stuck. Invalid *input* is a bug and is never masked.
- **Provider choice:** chosen only from environment variables on the server. The browser never sees the key.

### What the AI can never do

Change the plan, calculate money, contact anyone, or see contacts, vendor quotes or guest names.

---

## 20. Security and privacy

| Threat | Control |
|---|---|
| Prompt injection | Text is sanitised, wrapped as data and checked for known attack phrases; outputs must match strict schemas |
| Huge or malicious requests | Content-type check and body caps: 8 KB for intake and chaos describe, 200 KB for messages and concepts, 20 KB for narrate; size limits on every list in the plan |
| Leaked keys or internals | AI code is server-only (enforced by lint rules); errors return generic messages with no stack traces, file paths or provider text |
| Abuse and cost spikes | Per-IP rate limit (default 30 per minute, configurable 1–120) with `Retry-After`; container deploys cap instances |
| Cross-site requests | Requests from another website's origin are rejected with 403 |
| XSS and clickjacking | Strict Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, and camera, microphone, location and payment permissions disabled |
| Spreadsheet attacks | CSV cells that could run as formulas are neutralised |
| Corrupt or hostile backups | Size limit, schema validation, unknown keys stripped, fresh IDs |

An automated test scans the whole codebase on every run for dangerous patterns: raw HTML injection, `eval`, direct storage access outside the safe wrapper, environment reads outside the server, network calls outside the API client, `console.log`, `any` types and anything that looks like a secret.

**Privacy by design:** guests are counts only; contacts are kept outside the plan; vendor quotes are never sent to the AI; vendor briefs leave out the budget; the printable plan leaves out phone numbers and private notes; plans live on the device.

---

## 21. Accessibility

- Semantic landmarks (header, navigation, main, assistant) and a "Skip to main content" link.
- Full keyboard use: tabs with arrow keys, Home and End; dialogs that trap focus and return it to the button that opened them; Escape to close.
- Screen-reader announcements through a polite live region for important events (saved, proposal ready, activity changed), never for every keystroke. Character counters announce only at 80%, 90% and 100%.
- Status is never shown by colour alone: every badge, meter and warning pairs colour with an icon and words.
- Colour contrast meets WCAG 2.1 AA for all text pairs (calculated ratios are listed in ARCHITECTURE.md).
- Touch targets are at least 44 × 44 px.
- Reduced-motion settings are respected, and print styles produce clean run sheets.
- System fonts and local SVG art: no layout shift and no third-party trackers.
- Every page and component is checked with axe-core in the test suite.

---

## 22. Performance and efficiency

- **Most work happens locally:** budget maths, Budget Guardian tools, Chaos Lab simulations, stress tests, delay planning, guest insights, quote comparison and every export run in the browser with no network call.
- **Small requests:** the plan sent to the server is trimmed to the last 20 ledger entries; Chaos Lab free text sends only a few hundred bytes of vocabulary.
- **One call for compound requests:** three requests in one message cost one AI call, resolved locally.
- **Shared health check:** one status request per page load instead of three.
- **Cached AI answers:** identical prompts are answered from cache.
- **Memoised derived data:** expensive calculations are cached per plan version, so screens don't recompute on every render.
- **No server state:** nothing to synchronise and no database.
- **Small container:** the Docker image contains only the files the server actually needs, and runs as a non-root user.

---

## 23. Testing

Run `npm test` (all tests) or `npm run test:coverage` (with coverage).

- **630 tests in 130 files**, with about 89% statement coverage.
- **Engine unit tests:** pricing, budget, propagation, patches, conflicts, risk, every chaos scenario, delay strategies, guest insights, quote comparison, compound requests and free-text disaster checks.
- **Property tests:** 100 random sequences of edits across all four event types. After every change they check that the plan is valid, the version goes up by one, locked items are untouched, money is never negative, the schedule stays within the day, and the hard cap holds.
- **Server tests:** origin checks, size limits, rate limits, error scrubbing (no key or path leaks) and AI fallback.
- **AI tests:** schemas, prompts (untrusted text is wrapped), mocks (including Hinglish) and the full task pipeline.
- **UI tests:** every page and key component, with keyboard behaviour and axe-core accessibility checks, including the hydration-safety regression test.
- **Integration tests:** the golden-path demo journey through the real API handler, offline AI and store; every chat step is approved and must stay under the hard cap.
- **Quality and security guards:** JSDoc on exported functions, banned patterns, plain-English copy.

---

## 24. Glossary

| Term | Meaning |
|---|---|
| **Plan** | One celebration: facts, constraints, budget items, schedule, tasks, vendors, guest needs, concepts and history |
| **Constraint** | A rule such as a budget cap or guest limit; **hard** constraints can never be broken, **soft** ones are preferences |
| **Rate card** | Momently's benchmark prices per item family and quality level (essential, standard, premium) for tier-1 cities |
| **City tier** | Price multiplier by city: tier 1 ×1.0, tier 2 ×0.8, tier 3 ×0.65 |
| **Provenance** | Where a price came from: estimate, your input or verified quote |
| **Lock** | A host setting that stops automatic changes to a line item |
| **Patch / proposal** | A set of changes waiting for approval |
| **Recovery option** | A proposal with its impact, Chaos Score change, approvals needed and funding choices |
| **Funding option** | A set of savings that pays for a proposal that would otherwise break the cap |
| **Lever** | One way to save: step an item down a quality level or remove an optional item |
| **Chaos Score** | 0–100 sum of transparent risk points; banded Calm, Manageable, Exposed or Fragile |
| **Version** | A counter that goes up with every approved change; used to block out-of-date proposals |
| **Ledger** | The permanent list of every approved decision |
| **Snapshot** | A saved copy of the plan before a change, used for comparing and restoring |
| **Degraded** | The answer came from the offline engine because live AI failed |
| **Demo mode** | Running without an API key; every AI task uses the offline engine |
