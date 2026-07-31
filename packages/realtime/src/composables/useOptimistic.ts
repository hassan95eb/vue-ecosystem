import {
  computed,
  ref,
  shallowRef,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'
import { createLogger, EcosystemError } from '@vue-ecosystem/core'

const logger = createLogger('realtime').extend('useOptimistic')

export interface UseOptimisticOptions<T> {
  /** Called after a `commit()` rolls back, with the wrapped error and the value it rolled back to. */
  readonly onError?: (error: EcosystemError, rolledBackTo: T) => void
}

export interface UseOptimisticReturn<T> {
  /** The optimistic value while a commit is in flight; the last server-confirmed value otherwise. */
  readonly value: ComputedRef<T>
  /** `true` while at least one `commit()` is in flight. */
  readonly isPending: ComputedRef<boolean>
  /** The error from the most recent failed commit; cleared at the start of the next one. */
  readonly error: ComputedRef<EcosystemError | null>
  /**
   * Apply `optimisticValue` immediately, then run `mutate`. On success, `value`
   * becomes whatever `mutate` resolved to (or stays `optimisticValue` if
   * `mutate` resolves to `undefined`). On failure, `value` rolls back to the
   * last server-confirmed value, `error` is set, and the returned promise
   * rejects with the same (wrapped) error -- so callers that only care about
   * the reactive state can ignore the rejection, and callers that want a
   * try/catch at the call site still get one.
   *
   * Rollback only ever moves `value` backwards if this is still the most
   * recent `commit()` call: if a newer commit started before this one
   * settled, its optimistic value is never clobbered by an older one's
   * failure. Concurrent commits are not merged or queued -- the newest one
   * wins the display, each is still tracked independently for `isPending`.
   */
  readonly commit: (optimisticValue: T, mutate: () => Promise<T | void>) => Promise<void>
}

/**
 * Optimistic-update state for a single value, with rollback on failure.
 *
 * ```ts
 * const { value, isPending, commit } = useOptimistic(todo)
 *
 * async function toggle() {
 *   await commit({ ...todo.value, done: !todo.value.done }, () => api.updateTodo(todo.value))
 * }
 * ```
 */
export function useOptimistic<T>(
  initialValue: MaybeRefOrGetter<T>,
  options: UseOptimisticOptions<T> = {},
): UseOptimisticReturn<T> {
  const confirmed = ref(toValue(initialValue)) as Ref<T>
  const displayed = shallowRef(toValue(initialValue)) as Ref<T>
  const pendingCount = ref(0)
  const errorRef = shallowRef<EcosystemError | null>(null)

  let generation = 0

  async function commit(optimisticValue: T, mutate: () => Promise<T | void>): Promise<void> {
    const myGeneration = ++generation
    displayed.value = optimisticValue
    errorRef.value = null
    pendingCount.value += 1

    try {
      const result = await mutate()
      const resolved = result === undefined ? optimisticValue : result
      confirmed.value = resolved
      if (generation === myGeneration) {
        displayed.value = resolved
      }
      // Otherwise a newer commit has already taken over `displayed`; this
      // one's success still updates the confirmed baseline, just not the view.
    } catch (err) {
      const wrapped =
        err instanceof EcosystemError
          ? err
          : new EcosystemError('Optimistic update failed', {
              code: 'realtime/optimistic-update-failed',
              cause: err,
            })
      errorRef.value = wrapped
      logger.error('commit failed, rolling back', err)
      if (generation === myGeneration) {
        displayed.value = confirmed.value
      }
      options.onError?.(wrapped, confirmed.value)
      throw wrapped
    } finally {
      pendingCount.value -= 1
    }
  }

  return {
    value: computed(() => displayed.value),
    isPending: computed(() => pendingCount.value > 0),
    error: computed(() => errorRef.value),
    commit,
  }
}
