import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useOptimistic } from '../src/composables/useOptimistic'

/** A promise plus its resolve/reject, so a test can control exactly when a "mutate" settles. */
function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useOptimistic', () => {
  it('applies the optimistic value immediately, then the resolved value', async () => {
    const { value, isPending, commit } = useOptimistic({ count: 0 })
    const { promise, resolve } = deferred<{ count: number }>()

    const p = commit({ count: 1 }, () => promise)

    expect(value.value).toEqual({ count: 1 })
    expect(isPending.value).toBe(true)

    resolve({ count: 100 }) // server returned a different value than the optimistic guess
    await p

    expect(value.value).toEqual({ count: 100 })
    expect(isPending.value).toBe(false)
  })

  it('keeps the optimistic value when mutate resolves void', async () => {
    const { value, commit } = useOptimistic({ count: 0 })

    await commit({ count: 1 }, async () => undefined)

    expect(value.value).toEqual({ count: 1 })
  })

  it('rolls back to the last confirmed value on failure, sets error, and rejects', async () => {
    const onError = vi.fn()
    const { value, error, commit } = useOptimistic<string>('base', { onError })

    await expect(commit('optimistic', () => Promise.reject(new Error('nope')))).rejects.toThrow(
      'Optimistic update failed',
    )

    expect(value.value).toBe('base')
    expect(error.value?.code).toBe('realtime/optimistic-update-failed')
    expect(error.value?.cause).toBeInstanceOf(Error)
    expect((error.value?.cause as Error).message).toBe('nope')
    expect(onError).toHaveBeenCalledWith(error.value, 'base')
  })

  it('clears a previous error when a new commit succeeds', async () => {
    const { error, commit } = useOptimistic('base')

    await expect(commit('a', () => Promise.reject(new Error('x')))).rejects.toThrow()
    expect(error.value).not.toBeNull()

    await commit('b', async () => 'b-confirmed')
    expect(error.value).toBeNull()
  })

  it('does not let an older commit rolling back clobber a newer commit already in flight', async () => {
    const { value, commit } = useOptimistic('base')
    const first = deferred<string>()
    const second = deferred<string>()

    const firstCommit = commit('first-optimistic', () => first.promise)
    expect(value.value).toBe('first-optimistic')

    const secondCommit = commit('second-optimistic', () => second.promise)
    expect(value.value).toBe('second-optimistic')

    first.reject(new Error('first failed'))
    await expect(firstCommit).rejects.toThrow('Optimistic update failed')
    // The first commit's rollback must not stomp the second's still-in-flight optimistic value.
    expect(value.value).toBe('second-optimistic')

    second.resolve('second-confirmed')
    await secondCommit
    expect(value.value).toBe('second-confirmed')
  })

  it('isPending reflects the number of in-flight commits, not just the latest', async () => {
    const { isPending, commit } = useOptimistic(0)
    const first = deferred<number>()
    const second = deferred<number>()

    const firstCommit = commit(1, () => first.promise)
    const secondCommit = commit(2, () => second.promise)
    expect(isPending.value).toBe(true)

    first.resolve(1)
    await firstCommit
    expect(isPending.value).toBe(true) // second is still in flight

    second.resolve(2)
    await secondCommit
    expect(isPending.value).toBe(false)
  })

  it('reads the initial value from a plain value, ref or getter', () => {
    expect(useOptimistic('plain').value.value).toBe('plain')
    expect(useOptimistic(ref('from-ref')).value.value).toBe('from-ref')
    expect(useOptimistic(() => 'from-getter').value.value).toBe('from-getter')
  })
})
