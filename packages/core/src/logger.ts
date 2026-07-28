import { isDebugEnabled } from './internal/debug-flag'

/**
 * Tiny namespaced debug logger.
 *
 * Opt-in and side-effect free: when debug is off, `logger.log()` is an empty
 * function body, and because the package is marked `sideEffects: false` a
 * production bundler drops any logger the app never references.
 *
 * Enable at runtime:
 *   - browser: `localStorage.setItem('vue-ecosystem:debug', 'persian-tools:*')`
 *   - node:    `DEBUG=persian-tools:* node app.js`
 *
 * The pattern is a comma-separated list of namespaces; `*` is a wildcard
 * (`persian-tools:*`, or just `*` for everything).
 */
export interface Logger {
  readonly namespace: string
  /** True when this namespace currently matches the debug filter. */
  readonly enabled: boolean
  log: (...args: readonly unknown[]) => void
  warn: (...args: readonly unknown[]) => void
  error: (...args: readonly unknown[]) => void
  /** Derive a child logger, e.g. `createLogger('persian-tools').extend('jalali')`. */
  extend: (suffix: string) => Logger
}

const noop = (): void => {}

export function createLogger(namespace: string): Logger {
  const enabled = isDebugEnabled(namespace)
  const prefix = `[${namespace}]`

  return {
    namespace,
    enabled,
    log: enabled
      ? (...args: readonly unknown[]): void => {
          // eslint-disable-next-line no-console
          console.log(prefix, ...args)
        }
      : noop,
    warn: enabled
      ? (...args: readonly unknown[]): void => {
          console.warn(prefix, ...args)
        }
      : noop,
    // Errors are always surfaced: silently swallowing them is never the useful
    // default, debug flag or not.
    error: (...args: readonly unknown[]): void => {
      console.error(prefix, ...args)
    },
    extend: (suffix: string): Logger => createLogger(`${namespace}:${suffix}`),
  }
}
