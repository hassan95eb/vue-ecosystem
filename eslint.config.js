import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

/**
 * Single root flat config, shared by every package.
 *
 * The important rule here is the `internal/` boundary (see below): without it,
 * the public/internal API split is a convention only, and conventions erode.
 */
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/.turbo/**', '**/*.d.ts'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // --- Package boundary enforcement -------------------------------------
  // 1. No package may reach into another package's `internal/` folder.
  // 2. No package may deep-import another package's `src/` -- go through the
  //    published entry point so the exports map stays meaningful.
  // 3. Inside a package, use relative paths rather than the package's own name.
  {
    files: ['packages/**/*.{ts,vue}', 'apps/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@vue-ecosystem/*/internal', '@vue-ecosystem/*/internal/*'],
              message:
                "'internal/' is private to its package. Import from the package root instead.",
            },
            {
              group: ['@vue-ecosystem/*/src', '@vue-ecosystem/*/src/*'],
              message: 'Do not deep-import another package’s src/. Use its public entry point.',
            },
            {
              group: ['**/../*/src/**'],
              message:
                'Cross-package relative imports bypass the exports map. Depend on the package instead.',
            },
          ],
        },
      ],
    },
  },

  // A package's own internal/ code is naturally allowed to import itself.
  {
    files: ['packages/*/src/internal/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },

  {
    files: ['**/*.vue'],
    extends: [...pluginVue.configs['flat/recommended']],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] },
    },
  },

  {
    files: ['**/tests/**/*.ts', '**/*.config.ts', 'vitest.config.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  prettier,
)
