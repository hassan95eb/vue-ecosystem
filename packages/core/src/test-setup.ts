/**
 * Shared Vitest setup, wired in once from the root `vitest.config.ts`.
 * Exported as a subpath (`@vue-ecosystem/core/test-setup`) so downstream consumers
 * of the ecosystem can reuse the same matchers in their own suites.
 *
 * The matcher *types* live in `../matchers.d.ts` -- see the comment there for why
 * they are not declared inline.
 */
import { expect, beforeEach } from 'vitest'
import { isEcosystemError } from './errors'

expect.extend({
  toBeEcosystemError(received: unknown, code?: string) {
    if (!isEcosystemError(received)) {
      return {
        pass: false,
        message: (): string =>
          `expected value to be an EcosystemError, received ${this.utils.printReceived(received)}`,
      }
    }
    if (code !== undefined && received.code !== code) {
      return {
        pass: false,
        message: (): string =>
          `expected EcosystemError with code ${this.utils.printExpected(code)}, ` +
          `received ${this.utils.printReceived(received.code)}`,
      }
    }
    return {
      pass: true,
      message: (): string =>
        `expected value not to be an EcosystemError${code === undefined ? '' : ` (${code})`}`,
    }
  },
})

// Debug logging is opt-in; make sure a stray env var in CI can never turn it on
// mid-suite and pollute test output.
beforeEach(() => {
  delete process.env['vue-ecosystem:debug']
})
