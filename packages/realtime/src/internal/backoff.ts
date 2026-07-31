/**
 * Pure exponential-backoff-with-jitter calculator for reconnect delays.
 *
 * Deliberately pure and framework-free -- no timers, no socket, no Vue import --
 * so it can be (and is) unit-tested directly. `useWebSocket` is the only caller
 * today; it is exported from the package root because the same shape of
 * problem shows up in any hand-rolled reconnect loop, not just this package's.
 */

export interface BackoffOptions {
  /** Delay before the first reconnect attempt, in ms. Default `300`. */
  readonly baseDelayMs?: number
  /** Ceiling the computed delay is clamped to before jitter, in ms. Default `10_000`. */
  readonly maxDelayMs?: number
  /** Growth factor applied per attempt. Default `2`. */
  readonly multiplier?: number
  /**
   * Full-jitter fraction in `[0, 1]` applied to the capped delay: `0` disables
   * jitter (always return the capped value), `1` allows anywhere from `0` up to
   * the capped value. Default `0.5`.
   */
  readonly jitter?: number
  /** Injectable random source returning `[0, 1)`. Default `Math.random`. Exists so tests are deterministic. */
  readonly random?: () => number
}

const DEFAULT_BASE_DELAY_MS = 300
const DEFAULT_MAX_DELAY_MS = 10_000
const DEFAULT_MULTIPLIER = 2
const DEFAULT_JITTER = 0.5

/**
 * Delay before reconnect attempt number `attempt`, in ms.
 *
 * `attempt` is 1-based: the first retry after a connection drops is attempt
 * `1`. Growth is `baseDelayMs * multiplier ** (attempt - 1)`, capped at
 * `maxDelayMs`, then randomised within `[capped * (1 - jitter), capped]` so
 * that many clients reconnecting after the same outage don't all hit the
 * server in the same instant (the thundering-herd problem plain exponential
 * backoff does not solve on its own).
 */
export function computeReconnectDelay(attempt: number, options: BackoffOptions = {}): number {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new RangeError(`attempt must be an integer >= 1, got ${attempt}`)
  }

  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS
  const multiplier = options.multiplier ?? DEFAULT_MULTIPLIER
  const jitter = options.jitter ?? DEFAULT_JITTER
  const random = options.random ?? Math.random

  const uncapped = baseDelayMs * multiplier ** (attempt - 1)
  const capped = Math.min(uncapped, maxDelayMs)

  if (jitter <= 0) return capped

  const floor = capped * (1 - jitter)
  return floor + random() * (capped - floor)
}
