import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'max-lines': ['warn', { max: 250, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', 10],
    },
  },
  // Architectural boundary: Client-side components and state stores must NEVER import
  // server-only LLM infrastructure (geminiProvider or provider factory). This prevents
  // leaking API keys, pulling Node-only SDKs into client bundles, or bypassing API routes.
  {
    files: ['src/components/**', 'src/store/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/llm/geminiProvider',
                '@/llm/geminiProvider/*',
                '**/llm/geminiProvider',
                '**/llm/geminiProvider/*',
                '@/llm/factory',
                '@/llm/factory/*',
                '**/llm/factory',
                '**/llm/factory/*',
              ],
              message:
                'Client code (components/store) must never import server-only LLM providers or factories. Use API endpoints instead.',
            },
          ],
        },
      ],
    },
  },
  // Architectural boundary: Client code (components/store/lib) must NEVER import server-only code (src/server/**).
  {
    files: ['src/components/**', 'src/store/**', 'src/lib/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server', '@/server/**', '**/server', '**/server/**'],
              message:
                'Client code (components/store/lib) must never import from src/server. Server-only logic must remain on the server.',
            },
          ],
        },
      ],
    },
  },
  // Architectural boundary: Only src/store may call the engine's applyPatch directly.
  // Components and pages must go through the store (approveAndApply or applyUserEdit). Previews through previewOps are allowed.
  {
    files: ['src/components/**', 'src/app/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/engine/patch',
              importNames: ['applyPatch'],
              message:
                'applyPatch can only be called from src/store. Components and pages must go through the store.',
            },
            {
              name: '@/engine',
              importNames: ['applyPatch'],
              message:
                'applyPatch can only be called from src/store. Components and pages must go through the store.',
            },
          ],
        },
      ],
    },
  },
  prettier,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
