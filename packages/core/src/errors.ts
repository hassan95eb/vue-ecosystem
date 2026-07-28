/**
 * Base error type for the ecosystem.
 *
 * ## Why the symbol tag instead of plain `instanceof`
 *
 * Every package ships dual ESM + CJS output. If a consuming project ends up with
 * two resolution paths to `@vue-ecosystem/core` (an older bundler, a Jest CJS
 * transform, a nested duplicate in node_modules), two *separate* copies of this
 * module are loaded. To JavaScript those are two unrelated classes, so
 * `err instanceof EcosystemError` silently returns `false` for an error that
 * genuinely is one -- the classic dual package hazard.
 *
 * `Symbol.for()` uses the cross-realm global symbol registry, so the tag is
 * identical across duplicated module instances. Type checks therefore go through
 * `isEcosystemError()`, never through a bare `instanceof`.
 */

/** Global-registry symbol: identical across duplicated copies of this module. */
export const ECOSYSTEM_ERROR_TAG: unique symbol = Symbol.for(
  'vue-ecosystem.error',
) as typeof ECOSYSTEM_ERROR_TAG

export interface EcosystemErrorOptions extends ErrorOptions {
  /** Stable, machine-readable identifier, e.g. `persian-tools/invalid-jalali-date`. */
  code?: string
  /** Free-form structured detail attached for logging or debugging. */
  details?: Readonly<Record<string, unknown>>
}

export class EcosystemError extends Error {
  readonly [ECOSYSTEM_ERROR_TAG] = true

  /** Machine-readable error code. Defaults to `ecosystem/unknown`. */
  readonly code: string

  readonly details: Readonly<Record<string, unknown>> | undefined

  constructor(message: string, options: EcosystemErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = new.target.name
    this.code = options.code ?? 'ecosystem/unknown'
    this.details = options.details

    // Restore the prototype chain when the output is down-levelled to ES5 by a
    // consumer's toolchain; harmless otherwise.
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Duplicate-module-safe replacement for `err instanceof EcosystemError`.
 * Always prefer this over `instanceof` when checking errors across package
 * boundaries.
 */
export function isEcosystemError(err: unknown): err is EcosystemError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as Record<PropertyKey, unknown>)[ECOSYSTEM_ERROR_TAG] === true
  )
}
