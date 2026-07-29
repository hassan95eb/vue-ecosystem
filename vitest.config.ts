/**
 * The single Vitest config for the whole monorepo.
 *
 * Deliberately the ONLY Vitest config in the repo: no package carries its own.
 * That keeps the test environment and setup files in one place.
 *
 * NOTE ON THE FILENAME: the original plan called this `vitest.workspace.ts`.
 * Vitest 3.2 deprecated the separate workspace file in favour of `test.projects`
 * here, and will remove it in v4 -- it prints a deprecation warning on every run.
 * The intent is unchanged (one root-level config, projects per environment); only
 * the file it lives in moved. See ARCHITECTURE.md.
 *
 * NOTE ON CACHING: this file alone does NOT give per-package Turborepo cache
 * granularity. That comes from each `packages/<name>/package.json` declaring its
 * own `test` script scoped to that package's directory. Do not merge those into a
 * single root script.
 */
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const shared = {
  setupFiles: ['./packages/core/src/test-setup.ts'],
  exclude: ['**/node_modules/**', '**/dist/**'],
}

export default defineConfig({
  test: {
    projects: [
      {
        // Inline projects do not inherit the root `plugins` array, so the
        // Vue plugin is repeated per project rather than declared once at
        // the top level -- needed once any package ships real .vue SFCs
        // (currently persian-tools' PersianDateRangePicker and badge
        // components); without it Vitest can't parse a `.vue` file pulled
        // in by a test, even indirectly through a package's `src/index.ts`.
        plugins: [vue()],
        test: {
          ...shared,
          name: 'unit',
          include: ['packages/*/tests/**/*.test.ts'],
          // `*.dom.test.ts` belongs to the jsdom project below.
          exclude: [...shared.exclude, '**/*.dom.test.ts'],
          environment: 'node',
        },
      },
      {
        plugins: [vue()],
        test: {
          ...shared,
          name: 'dom',
          include: ['packages/*/tests/**/*.dom.test.ts'],
          environment: 'jsdom',
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/index.ts', '**/types.ts', '**/test-setup.ts', '**/*.d.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
