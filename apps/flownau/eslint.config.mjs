import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

import eslintConfigPrettier from 'eslint-config-prettier'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
  {
    rules: {
      // Re-enabled (Pass A): safe mechanical fixes
      'prefer-const': 'error',
      '@next/next/no-img-element': 'warn',

      // Re-enabled (Pass B): stricter type safety
      // Warn (not error) — the OpenAI/Groq SDKs force some `any` usage
      '@typescript-eslint/no-explicit-any': 'warn',
      // Unused vars are errors; prefix with _ to intentionally ignore
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // react-hooks/exhaustive-deps is already configured by eslint-config-next.

      // Kept off: render-worker.ts uses `require.main === module`
      // which is a valid Node.js CJS interop pattern in an ESM project
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
])

export default eslintConfig
