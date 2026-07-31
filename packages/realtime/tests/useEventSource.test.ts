import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEventSource } from '../src/composables/useEventSource'

type Listener = (event: unknown) => void

/**
 * Hand-rolled fake, not a real `EventSource` subclass -- same rationale as
 * `FakeWebSocket` in useWebSocket.test.ts. Supports arbitrary named events
 * (not just `open`/`message`/`error`) since that's a real part of the SSE
 * wire format this composable exposes via `options.events`.
 */
class FakeEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2

  readyState = FakeEventSource.CONNECTING
  closeCallCount = 0

  private readonly listeners = new Map<string, Set<Listener>>()

  constructor(
    readonly url: string,
    readonly withCredentials?: boolean,
  ) {}

  addEventListener(type: string, listener: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(listener)
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener)
  }

  close(): void {
    this.closeCallCount += 1
    this.readyState = FakeEventSource.CLOSED
  }

  private emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }

  simulateOpen(): void {
    this.readyState = FakeEventSource.OPEN
    this.emit('open', {})
  }

  simulateMessage(data: unknown): void {
    this.emit('message', { data })
  }

  simulateNamedEvent(name: string, data: unknown): void {
    this.emit(name, { data })
  }

  /** A drop the client didn't initiate -- native EventSource would retry on its own; we take over instead. */
  simulateError(): void {
    this.emit('error', {})
  }
}

describe('useEventSource', () => {
  let sources: FakeEventSource[]
  let createEventSource: (url: string, withCredentials?: boolean) => EventSource

  beforeEach(() => {
    vi.useFakeTimers()
    sources = []
    createEventSource = (url, withCredentials) => {
      const es = new FakeEventSource(url, withCredentials)
      sources.push(es)
      return es as unknown as EventSource
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('connects immediately by default and reflects open/message state', () => {
    const scope = effectScope()
    scope.run(() => {
      const { status, data } = useEventSource('/stream', { createEventSource })

      expect(sources).toHaveLength(1)
      expect(status.value).toBe('connecting')

      sources[0]!.simulateOpen()
      expect(status.value).toBe('open')

      sources[0]!.simulateMessage('hello')
      expect(data.value).toBe('hello')
    })
    scope.stop()
  })

  it('does not connect when immediate is false, and open() connects manually', () => {
    const scope = effectScope()
    scope.run(() => {
      const { status, open } = useEventSource('/stream', {
        createEventSource,
        immediate: false,
      })

      expect(sources).toHaveLength(0)
      expect(status.value).toBe('idle')

      open()
      expect(sources).toHaveLength(1)
      expect(status.value).toBe('connecting')
    })
    scope.stop()
  })

  it('dispatches named events to their own handler, separate from `data`', () => {
    const priceUpdate = vi.fn()
    const scope = effectScope()
    scope.run(() => {
      const { data } = useEventSource('/stream', {
        createEventSource,
        events: { priceUpdate },
      })

      sources[0]!.simulateOpen()
      sources[0]!.simulateNamedEvent('priceUpdate', { price: 42 })

      expect(priceUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { price: 42 } }))
      expect(data.value).toBe(null) // named events don't touch `data`, only `message` does
    })
    scope.stop()
  })

  it('takes over reconnection: closes the native source and retries with backoff on error', () => {
    const scope = effectScope()
    scope.run(() => {
      const { status, reconnectAttempt } = useEventSource('/stream', {
        createEventSource,
        backoff: { baseDelayMs: 100, multiplier: 2, jitter: 0 },
      })

      sources[0]!.simulateOpen()
      sources[0]!.simulateError()

      expect(sources[0]!.closeCallCount).toBe(1) // native auto-retry pre-empted
      expect(status.value).toBe('reconnecting')
      expect(reconnectAttempt.value).toBe(1)
      expect(sources).toHaveLength(1)

      vi.advanceTimersByTime(100)
      expect(sources).toHaveLength(2)

      sources[1]!.simulateOpen()
      expect(status.value).toBe('open')
      expect(reconnectAttempt.value).toBe(0)
    })
    scope.stop()
  })

  it('gives up after maxAttempts consecutive failures', () => {
    const scope = effectScope()
    scope.run(() => {
      const { status } = useEventSource('/stream', {
        createEventSource,
        autoReconnect: { maxAttempts: 1 },
        backoff: { baseDelayMs: 50, jitter: 0 },
      })

      sources[0]!.simulateError()
      expect(status.value).toBe('reconnecting')

      vi.advanceTimersByTime(50)
      expect(sources).toHaveLength(2)

      sources[1]!.simulateError()
      expect(status.value).toBe('closed')

      vi.advanceTimersByTime(10_000)
      expect(sources).toHaveLength(2)
    })
    scope.stop()
  })

  it('does not reconnect when autoReconnect is false', () => {
    const scope = effectScope()
    scope.run(() => {
      const { status } = useEventSource('/stream', {
        createEventSource,
        autoReconnect: false,
      })

      sources[0]!.simulateError()
      expect(status.value).toBe('closed')

      vi.advanceTimersByTime(10_000)
      expect(sources).toHaveLength(1)
    })
    scope.stop()
  })

  it('falls back to the global EventSource constructor when createEventSource is not provided', () => {
    vi.stubGlobal(
      'EventSource',
      class extends FakeEventSource {
        constructor(url: string, eventSourceInit?: EventSourceInit) {
          super(url, eventSourceInit?.withCredentials)
          sources.push(this)
        }
      },
    )

    const scope = effectScope()
    scope.run(() => {
      const { status } = useEventSource('/stream')

      expect(sources).toHaveLength(1)
      expect(sources[0]!.url).toBe('/stream')
      expect(status.value).toBe('connecting')
    })
    scope.stop()
    vi.unstubAllGlobals()
  })

  it('manual close() cancels auto-reconnect', () => {
    const scope = effectScope()
    scope.run(() => {
      const { status, close } = useEventSource('/stream', {
        createEventSource,
        backoff: { baseDelayMs: 50, jitter: 0 },
      })

      sources[0]!.simulateOpen()
      close()
      expect(status.value).toBe('closed')
      expect(sources[0]!.closeCallCount).toBe(1)

      vi.advanceTimersByTime(10_000)
      expect(sources).toHaveLength(1)
    })
    scope.stop()
  })

  it('surfaces a construct-time throw from the source factory and settles into closed', () => {
    const scope = effectScope()
    scope.run(() => {
      const { status, error } = useEventSource('/stream', {
        createEventSource: () => {
          throw new Error('no network')
        },
      })

      expect(error.value?.code).toBe('realtime/source-construct-error')
      expect(status.value).toBe('closed')
      expect(sources).toHaveLength(0)
    })
    scope.stop()
  })

  it('disposes cleanly when the effect scope stops: closes the source and cancels pending retries', () => {
    const scope = effectScope()
    let src: FakeEventSource
    scope.run(() => {
      useEventSource('/stream', {
        createEventSource,
        backoff: { baseDelayMs: 50, jitter: 0 },
      })
      src = sources[0]!
      src.simulateOpen()
    })

    scope.stop()
    expect(src!.closeCallCount).toBe(1)

    src!.simulateError()
    vi.advanceTimersByTime(10_000)
    expect(sources).toHaveLength(1)
  })
})
