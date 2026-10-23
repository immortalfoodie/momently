# Momently Dependencies

Every direct runtime and development dependency in `package.json` is listed below with its purpose in the repository.

## Runtime Dependencies (`dependencies`)

| Package | Version | Purpose |
| :--- | :--- | :--- |
| `@google/genai` | `^2.30.0` | Official Google GenAI SDK used in `src/llm/geminiProvider.ts` for server-side Gemini completions. |
| `next` | `16.4.2` | Next.js App Router framework providing routing, layouts, and stateless `/api/*` route handlers. |
| `react` | `19.3.0` | Core React UI library for interactive celebration studio components and hooks. |
| `react-dom` | `19.3.0` | React DOM rendering bindings for the browser and component test harnesses. |
| `zod` | `^4.6.7` | Runtime schema validation and static TypeScript type inference across domain, LLM, store, and API boundaries. |
| `zustand` | `^5.0.15` | Lightweight client-side state store (`src/store/eventsStore.ts`, `src/store/tourStore.ts`) with persistence middleware. |

## Development Dependencies (`devDependencies`)

| Package | Version | Purpose |
| :--- | :--- | :--- |
| `@tailwindcss/turbopack` | `^4` | Tailwind CSS v4 integration plugin for Next.js Turbopack builds. |
| `@testing-library/jest-dom` | `^7.0.1` | Custom DOM element matchers (`toBeInTheDocument`, `toHaveAttribute`) registered in `vitest.setup.ts`. |
| `@testing-library/react` | `^16.3.3` | React component rendering and query utilities for UI and accessibility tests (`tests/ui/`). |
| `@testing-library/user-event` | `^14.6.8` | Realistic keyboard and pointer user-interaction simulation in component tests. |
| `@types/node` | `^22.20.5` | TypeScript type definitions for Node.js built-in modules (`node:crypto`, `node:fs`, `node:path`). |
| `@types/react` | `^19` | TypeScript type definitions for React 19 APIs and JSX. |
| `@types/react-dom` | `^19` | TypeScript type definitions for React DOM 19 APIs. |
| `@vitejs/plugin-react` | `^6.1.2` | Vite plugin enabling React JSX/TSX transforms inside the Vitest runner (`vitest.config.ts`). |
| `@vitest/coverage-v8` | `^5.0.5` | V8 native code coverage provider for `npm run test:coverage` (`vitest.config.ts`). |
| `axe-core` | `^4.14.0` | Automated WCAG 2.1 AA accessibility auditing engine used via `tests/helpers/axe.ts`. |
| `eslint` | `^9` | Static code analysis and architectural import-boundary enforcement (`eslint.config.mjs`). |
| `eslint-config-next` | `16.4.2` | Next.js Core Web Vitals and TypeScript ESLint rulesets. |
| `eslint-config-prettier` | `^10.1.8` | Disables ESLint formatting rules that conflict with Prettier. |
| `jsdom` | `^29.1.1` | Browser DOM implementation for running component and client store tests in Node (`vitest.config.ts`). |
| `prettier` | `^3.9.10` | Deterministic code formatter (`npm run format`). |
| `prettier-plugin-tailwindcss` | `^0.8.1` | Automatically orders Tailwind CSS utility classes during Prettier runs (`.prettierrc`). |
| `tailwindcss` | `^4` | Utility-first CSS framework (`src/app/globals.css`). |
| `typescript` | `^5` | TypeScript compiler used for strict static type checking (`npm run typecheck`). |
| `vitest` | `^5.0.5` | Unit, integration, property-invariant, and UI test runner (`npm test`). |
