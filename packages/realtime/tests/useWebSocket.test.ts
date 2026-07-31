import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWebSocket } from '../src/composables/useWebSocket'

type Listener = (event: unknown) => void

/**
 * Hand-rolled fake, not a real `WebSocket` subclass: the composable under
 * test only ever touches `readyState`, `send`, `close`, `addEventListener`
 * and `removeEventListener`, so that's all this needs to implement. Using
 * the WHATWG-spec `readyState` numbers (0-3) directly means it lines up with
 * the composable's own inlined constants without depending on a global
 * `WebSocket` existing in the test runtime.
 */
class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readyState = FakeWebSocket.CONNECTING
  readonly sent: unknown[] = []
  readonly closeCalls: Array<{ code: number | undefined; reason: string | undefined }> = []

  private readonly listeners: Record<string, Set<Listener>> = {
    open: new Set(),
    message: new Set(),
    error: new Set(),
    close: new Set(),
  }

  constructor(
    readonly url: string,
    readonly protocols?: string | readonly string[],
  ) {}

  addEventListener(type: string, listener: Listener): void {
    this.listeners[type]?.add(listener)
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners[type]?.delete(listener)
  }

  send(data: unknown): void {
    this.sent.push(data)
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason })
    this.readyState = FakeWebSocket.CLOSING
  }

  private emit(type: string, event: unknown): void {
    for (const listener of this.listeners[type] ?? []) listener(event)
  }

  /** Simulate the server accepting the connection. */
  simulateOpen(): void {
    this.readyState = FakeWebSocket.OPEN
    this.emit('open', {})
  }

  simulateMessage(data: unknown): void {
    this.emit('message', { data })
  }

  simulateError(): void {
    this.emit('error', {})
  }

  /** Simulate the connection dropping for a reason the client didn't initiate. */
  simulateServerClose(code = 1006, reason = ''): void {
    this.readyState = FakeWebSocket.CLOSED
    this.emit('close', { code, reason })
  }
}

describe('useWebSocket', () => {
  let sockets: FakeWebSocket[]
  let createWebSocket: (url: string, protocols?: string | readonly string[]) => WebSocket

  beforeEach(() => {
    vi.useFakeTimers()
    sockets = []
    createWebSocket = (url, protocols) => {
      const ws = new FakeWebSocket(url, protocols)
      sockets.push(ws)
      return ws as unknown as WebSocket
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('connects immediately by default and reflects open/message state', () => {
    const scope = effectScope()
    scope.run(() => {
      const { status, data, reconnectAttempt } = useWebSocket('wss://example.test', {
        createWebSocket,
      })

      expect(sockets).toHaveLength(1)
      expect(status.value).toBe('connecting')

      sockets[0]!.simulateOpen()
      expect(status.value).toBe('open')
      expect(reconnectAttempt.value).toBe(0)

      sockets[0]!.simulateMessage('hello')
      expect(data.value).toBe('hello')
    })
    scope.stop()
  })

  it('does not connect when immediate is false, and open() connects manually', () => {
    const scope = effectScope()
    scope.run(() => {
      const { status, open } = useWebSocket('wss://example.test', {
        createWebSocket,
        immediate: false,
      })

      expect(sockets).toHaveLength(0)
      expect(status.value).toBe('idle')

      open()
      expect(sockets).toHaveLength(1)
      expect(status.value).toBe('connecting')
    })
    scope.stop()
  })

  it('send() is a no-op returning false until the socket is open', () => {
    const scope = effectScope()
    scope.run(() => {
      const { send, queueLength } = useWebSocket('wss://example.test', { createWebSocket })

      expect(send('too soon')).toBe(false)
      expect(sockets[0]!.sent).toHaveLength(0)
      expect(queueLength.value).toBe(0) // no queueing without queueWhenOffline

      sockets[0]!.simulateOpen()
      expect(send('now')).toBe(true)
      expect(sockets[0]!.sent).toEqual(['now'])
    })
    scope.stop()
  })

  it('queues send() while offline when queueWhenOffline is enabled, and flushes in order on open', () => {
    const scope = effectScope()
    scope.run(() => {
      const { send, queueLength } = useWebSocket('wss://example.test', {
        createWebSocket,
        queueWhenOffline: true,
      })

      expect(send('a')).toBe(false) // still not "sent now" -- only queued
      expect(send('b')).toBe(false)
      expect(queueLength.value).toBe(2)
      expect(sockets[0]!.sent).toHaveLength(0)

      sockets[0]!.simulateOpen()
      expect(sockets[0]!.sent).toEqual(['a', 'b']) // FIFO order
      expect(queueLength.value).toBe(0)
    })
    scope.stop()
  })

  it('drops the oldest queued message once maxQueueSize is exceeded', () => {
    const scope = effectScope()
    scope.run(() => {
      const { send, queueLength } = useWebSocket('wss://example.test', {
        createWebSocket,
        queueWhenOffline: { maxQueueSize: 2 },
      })

      send('a')
      send('b')
      send('c') // exceeds maxQueueSize=2 -> 'a' is dropped
      expect(queueLength.value).toBe(2)

      sockets[0]!.simulateOpen()
      expect(sockets[0]!.sent).toEqual(['b', 'c'])
    })
    scope.stop()
  })

  it('carries the queue across a reconnect, and clears it on manual close()', () => {
    const scope = effectScope()
    scope.run(() => {
      const { send, close, queueLength } = useWebSocket('wss://example.test', {
        createWebSocket,
        queueWhenOffline: true,
        backoff: { baseDelayMs: 50, jitter: 0 },
      })

      sockets[0]!.simulateOpen()
      sockets[0]!.simulateServerClose() // drops mid-flight, auto-reconnect kicks in
      send('queued-during-reconnect')
      expect(queueLength.value).toBe(1)

      vi.advanceTimersByTime(50)
      sockets[1]!.simulateOpen()
      expect(sockets[1]!.sent).toEqual(['queued-during-reconnect'])

      sockets[1]!.simulateServerClose() // drops again
      send('will-be-cleared')
      expect(queueLength.value).toBe(1)
      close()
      expect(queueLength.value).toBe(0)
    })
    scope.stop()
  })

  it('reconnects with backoff after an unexpected close, and resets the attempt counter on reopen', () => {
    const scope = effectScope()
    scope.run(() => {
      const { status, reconnectAttempt } = useWebSocket('wss://example.test', {
        createWebSocket,
        backoff: { baseDelayMs: 100, multiplier: 2, jitter: 0 },
      })

      sockets[0]!.simulateOpen()
      sockets[0]!.simulateServerClose()

      expect(status.value).toBe('reconnecting')
      expect(reconnectAttempt.value).toBe(1)
      expect(sockets).toHaveLength(1) // retry not scheduled to run yet

      vi.advanceTimersByTime(100)
      expect(sockets).toHaveLength(2)
      expect(status.value).toBe('reconnecting') // new attempt in flight

      sockets[1]!.simulateOpen()
      expect(status.value).toBe('open')
      expect(reconnectAttempt.value).toBe(0)
    })
    scope.stop()
  })

  it('gives up after maxAttempts consecutive failures', () => {
    const scope = effectScope()
    scope.run(() => {
      const { status } = useWebSocket('wss://example.test', {
        createWebSocket,
        autoReconnect: { maxAttempts: 1 },
        backoff: { baseDelayMs: 50, jitter: 0 },
      })

      sockets[0]!.simulateServerClose() // 1st failure -> 1 retry still allowed
      expect(status.value).toBe('reconnecting')

      vi.advanceTimersByTime(50)
      expect(sockets).toHaveLength(2)

      sockets[1]!.simulateServerClose() // 2nd consecutive failure -> exceeds maxAttempts
      expect(status.value).toBe('closed')

      vi.advanceTimersByTime(10_000)
      expect(sockets).toHaveLength(2) // no further attempts scheduled
    })
    scope.stop()
  })

  it('does not reconnect when autoReconnect is false', () => {
    const scope = effectScope()
    scope.run(() => {
      const { status } = useWebSocket('wss://example.test', {
        createWebSocket,
        autoReconnect: false,
      })

      sockets[0]!.simulateServerClose()
      expect(status.value).toBe('closed')

      vi.advanceTimersByTime(10_000)
      expect(sockets).toHaveLength(1)
    })
    scope.stop()
  })

  it('manual close() cancels auto-reconnect', () => {
    const scope = effectScope()
    scope.run(() => {
      const { status, close } = useWebSocket('wss://example.test', {
        createWebSocket,
        backoff: { baseDelayMs: 50, jitter: 0 },
      })

      sockets[0]!.simulateOpen()
      close(1000, 'bye')
      expect(status.value).toBe('closing')
      expect(sockets[0]!.closeCalls).toEqual([{ code: 1000, reason: 'bye' }])

      // The socket confirms the close the caller initiated.
      sockets[0]!.simulateServerClose(1000, 'bye')
      expect(status.value).toBe('closed')

      vi.advanceTimersByTime(10_000)
      expect(sockets).toHaveLength(1) // no reconnect after a manual close
    })
    scope.stop()
  })

  it('invokes the onOpen/onMessage/onError/onClose callbacks when provided', () => {
    const onOpen = vi.fn()
    const onMessage = vi.fn()
    const onError = vi.fn()
    const onClose = vi.fn()

    const scope = effectScope()
    scope.run(() => {
      useWebSocket('wss://example.test', {
        createWebSocket,
        autoReconnect: false,
        onOpen,
        onMessage,
        onError,
        onClose,
      })

      sockets[0]!.simulateOpen()
      expect(onOpen).toHaveBeenCalledTimes(1)

      sockets[0]!.simulateMessage('hi')
      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ data: 'hi' }))

      sockets[0]!.simulateError()
      expect(onError).toHaveBeenCalledTimes(1)

      sockets[0]!.simulateServerClose(1006, 'dropped')
      expect(onClose).toHaveBeenCalledWith(
        expect.objectContaining({ code: 1006, reason: 'dropped' }),
      )
    })
    scope.stop()
  })

  it('surfaces socket-level errors as an EcosystemError without changing status', () => {
    const scope = effectScope()
    scope.run(() => {
      const { status, error } = useWebSocket('wss://example.test', { createWebSocket })

      sockets[0]!.simulateOpen()
      sockets[0]!.simulateError()

      expect(error.value?.code).toBe('realtime/socket-error')
      expect(status.value).toBe('open') // the 'error' event alone doesn't close the socket
    })
    scope.stop()
  })

  it('disposes cleanly when the effect scope stops: closes the socket and cancels pending retries', () => {
    const scope = effectScope()
    let sock: FakeWebSocket
    scope.run(() => {
      useWebSocket('wss://example.test', {
        createWebSocket,
        backoff: { baseDelayMs: 50, jitter: 0 },
      })
      sock = sockets[0]!
      sock.simulateOpen()
    })

    scope.stop()
    expect(sock!.closeCalls).toHaveLength(1)

    // Even if the now-detached socket fires close, no reconnect is scheduled.
    sock!.simulateServerClose()
    vi.advanceTimersByTime(10_000)
    expect(sockets).toHaveLength(1)
  })

  it('falls back to the global WebSocket constructor when createWebSocket is not provided', () => {
    vi.stubGlobal(
      'WebSocket',
      class extends FakeWebSocket {
        constructor(url: string, protocols?: string | readonly string[]) {
          super(url, protocols)
          sockets.push(this)
        }
      },
    )

    const scope = effectScope()
    scope.run(() => {
      const { status } = useWebSocket('wss://example.test')

      expect(sockets).toHaveLength(1)
      expect(sockets[0]!.url).toBe('wss://example.test')
      expect(status.value).toBe('connecting')
    })
    scope.stop()
  })

  it('surfaces a construct-time throw from the socket factory and settles into closed', () => {
    const scope = effectScope()
    scope.run(() => {
      const { status, error } = useWebSocket('wss://example.test', {
        createWebSocket: () => {
          throw new Error('no network')
        },
      })

      expect(error.value?.code).toBe('realtime/socket-construct-error')
      expect(error.value?.cause).toBeInstanceOf(Error)
      expect(status.value).toBe('closed')
      expect(sockets).toHaveLength(0)
    })
    scope.stop()
  })

  it('close() before ever connecting just settles status to closed', () => {
    const scope = effectScope()
    scope.run(() => {
      const { status, close } = useWebSocket('wss://example.test', {
        createWebSocket,
        immediate: false,
      })

      close()
      expect(status.value).toBe('closed')
      expect(sockets).toHaveLength(0)
    })
    scope.stop()
  })

  it('dispose swallows an error thrown by the socket close() call', () => {
    const scope = effectScope()
    scope.run(() => {
      useWebSocket('wss://example.test', {
        createWebSocket: (url, protocols) => {
          const ws = new FakeWebSocket(url, protocols)
          ws.close = () => {
            throw new Error('already gone')
          }
          sockets.push(ws)
          return ws as unknown as WebSocket
        },
      })
      sockets[0]!.simulateOpen()
    })

    expect(() => scope.stop()).not.toThrow()
  })
})
