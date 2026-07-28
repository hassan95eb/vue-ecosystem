/**
 * Type declarations for the custom matchers registered by `./src/test-setup.ts`.
 *
 * Hand-written on purpose rather than generated: a bundled `.d.ts` drops the
 * `import 'vitest'` line, which turns the block below from a module *augmentation*
 * into a module *declaration* -- and that silently replaces Vitest's own types
 * (`describe`, `it`, `expect` all vanish) in any package that references it.
 *
 * Packages with tests reference this file from `tests/vitest.d.ts`:
 *   import '@vue-ecosystem/core/matchers'
 */
import 'vitest'

interface EcosystemMatchers<R = unknown> {
  /** Asserts the value is an ecosystem error, optionally with a specific `code`. */
  toBeEcosystemError: (code?: string) => R
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<T = unknown> extends EcosystemMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<T = unknown> extends EcosystemMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends EcosystemMatchers {}
}
