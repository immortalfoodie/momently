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
