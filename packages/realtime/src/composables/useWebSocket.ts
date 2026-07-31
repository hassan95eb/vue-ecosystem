import {
  computed,
  getCurrentScope,
  onScopeDispose,
  ref,
  shallowRef,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
} from 'vue'
import { createLogger, EcosystemError } from '@vue-ecosystem/core'
import { computeReconnectDelay, type BackoffOptions } from '../internal/backoff'

const logger = createLogger('realtime').extend('useWebSocket')

/**
 * `idle` -- never connected. `reconnecting` covers the whole retry cycle, from
 * the moment a drop is detected and a backoff delay is scheduled through the
 * next connection attempt; there is no separate "waiting" state in the MVP.
 */
export type ConnectionStatus =
  'idle' | 'connecting' | 'open' | 'closing' | 'closed' | 'reconnecting'

/** What `send()` accepts and what the offline queue stores. */
export type WebSocketMessage = string | ArrayBufferLike | Blob | ArrayBufferView

const DEFAULT_MAX_QUEUE_SIZE = 100

export interface UseWebSocketOptions {
  /** WebSocket sub-protocol(s), forwarded as-is to the constructor. */
  readonly protocols?: MaybeRefOrGetter<string | readonly string[] | undefined>
  /** Connect immediately when the composable runs. Default `true`. */
  readonly immediate?: boolean
  /**
   * Reconnect automatically when the connection drops without `close()` having
   * been called. Default `true`. Pass `{ maxAttempts }` to give up after N
   * consecutive failed attempts (the socket then settles into `'closed'`);
   * pass `false` to disable auto-reconnect entirely.
   */
  readonly autoReconnect?: boolean | { readonly maxAttempts?: number }
  /** Exponential-backoff tuning for the reconnect delay. See `computeReconnectDelay`. */
  readonly backoff?: BackoffOptions
  /**
   * Queue messages passed to `send()` while the socket isn't open, and flush
   * them in the same order once it opens (including after a reconnect).
   * Default `false` -- `send()` just returns `false` and drops the message.
   * Pass `{ maxQueueSize }` to cap how much is buffered (default `100`); past
   * the cap the oldest queued message is dropped to make room, with a
   * warning logged. A manual `close()` clears anything still queued.
   */
  readonly queueWhenOffline?: boolean | { readonly maxQueueSize?: number }
  /**
   * Factory producing the underlying socket. Defaults to the global
   * `WebSocket` constructor. Override in tests, or in a runtime where
   * `WebSocket` isn't a global (older Node, a custom SSR environment).
   */
  readonly createWebSocket?: (url: string, protocols?: string | readonly string[]) => WebSocket
  readonly onOpen?: (event: Event) => void
  readonly onMessage?: (event: MessageEvent) => void
  readonly onError?: (event: Event) => void
  readonly onClose?: (event: CloseEvent) => void
}

export interface UseWebSocketReturn {
  readonly status: ComputedRef<ConnectionStatus>
  /** Payload of the most recently received message; `null` before the first one. */
  readonly data: ComputedRef<unknown>
  /** Set when a socket-level error event fires; cleared on the next successful open. */
  readonly error: ComputedRef<EcosystemError | null>
  /**
   * `0` while idle, connecting or open; the 1-based count of consecutive
   * reconnect attempts otherwise.
   */
  readonly reconnectAttempt: ComputedRef<number>
  /**
   * Number of messages currently buffered by the offline queue (always `0`
   * when `queueWhenOffline` isn't enabled).
   */
  readonly queueLength: ComputedRef<number>
  /**
   * Send on the current socket. Returns `false` (never throws) when it isn't
   * open -- if `queueWhenOffline` is enabled, the message is buffered and
   * this still returns `false` (it wasn't sent *now*; check `queueLength` to
   * observe what's pending).
   */
  readonly send: (data: WebSocketMessage) => boolean
  /** (Re)connect, resetting the reconnect-attempt counter. No-op if already open or connecting. */
  readonly open: () => void
  /** Close the socket, cancel any pending auto-reconnect, and clear the offline queue. */
  readonly close: (code?: number, reason?: string) => void
}

function defaultCreateWebSocket(url: string, protocols?: string | readonly string[]): WebSocket {
  return new WebSocket(url, protocols as string | string[] | undefined)
}

// `WebSocket.readyState` values, inlined rather than read off the global
// `WebSocket` constructor. They are fixed by the WHATWG spec (every
// implementation, browser or Node's undici-based one, uses these exact
// numbers) and inlining them means this module never touches the global
// `WebSocket` object except inside `defaultCreateWebSocket` -- so a test (or
// a non-browser runtime) supplying `createWebSocket` never needs a real
// global `WebSocket` to exist at all.
const READY_STATE_CONNECTING = 0
const READY_STATE_OPEN = 1

/** `true` while a socket is still usable -- already open, or in the middle of opening. */
function isConnectingOrOpen(ws: WebSocket): boolean {
  return ws.readyState === READY_STATE_OPEN || ws.readyState === READY_STATE_CONNECTING
}

/**
 * `onScopeDispose` without the dev warning when called outside an effect
 * scope (e.g. ad-hoc script usage, or a test that doesn't wrap in `effectScope`).
 */
function registerDispose(fn: () => void): void {
  if (getCurrentScope()) {
    onScopeDispose(fn)
  }
}

/**
 * Reactive WebSocket connection with exponential-backoff auto-reconnect.
 *
 * ```ts
 * const { status, data, send } = useWebSocket('wss://example.com/socket')
 *
 * watch(data, (payload) => console.log('received', payload))
 * ```
 *
 * A single socket, backoff-based reconnection, manual open/close/send, and
 * an opt-in offline queue (`queueWhenOffline`) that buffers `send()` calls
 * made while not connected and flushes them in order on the next open. See
 * `useChannel` for multiplexing named pub/sub channels over one of these
 * connections, and this package's README for the full picture.
 */
export function useWebSocket(
  url: MaybeRefOrGetter<string>,
  options: UseWebSocketOptions = {},
): UseWebSocketReturn {
  const statusRef = ref<ConnectionStatus>('idle')
  const dataRef = shallowRef<unknown>(null)
  const errorRef = shallowRef<EcosystemError | null>(null)
  const attemptRef = ref(0)

  const queueLengthRef = ref(0)

  let socket: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let manuallyClosed = false
  let disposed = false
  const queue: WebSocketMessage[] = []

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function clearQueue(): void {
    queue.length = 0
    queueLengthRef.value = 0
  }

  function enqueue(data: WebSocketMessage): void {
    const queueOptions = options.queueWhenOffline
    const configuredMax = typeof queueOptions === 'object' ? queueOptions.maxQueueSize : undefined
    const maxQueueSize = configuredMax ?? DEFAULT_MAX_QUEUE_SIZE
    queue.push(data)
    if (queue.length > maxQueueSize) {
      queue.shift() // drop the oldest to make room for the newest
      logger.warn(`offline queue exceeded ${maxQueueSize} message(s); dropped the oldest`)
    }
    queueLengthRef.value = queue.length
  }

  /** Flush in FIFO order. Only called from `handleOpen`, where `socket` is always the just-opened one. */
  function flushQueue(): void {
    if (queue.length === 0) return
    const pending = queue.splice(0, queue.length)
    queueLengthRef.value = 0
    for (const message of pending) socket?.send(message)
  }

  function detachListeners(ws: WebSocket): void {
    ws.removeEventListener('open', handleOpen)
    ws.removeEventListener('message', handleMessage)
    ws.removeEventListener('error', handleError)
    ws.removeEventListener('close', handleClose)
  }

  function handleOpen(event: Event): void {
    statusRef.value = 'open'
    attemptRef.value = 0
    errorRef.value = null
    logger.log('open')
    flushQueue()
    options.onOpen?.(event)
  }

  function handleMessage(event: Event): void {
    dataRef.value = (event as MessageEvent).data
    options.onMessage?.(event as MessageEvent)
  }

  function handleError(event: Event): void {
    errorRef.value = new EcosystemError('WebSocket error', { code: 'realtime/socket-error' })
    logger.error('socket error', event)
    options.onError?.(event)
  }

  function handleClose(event: Event): void {
    const closeEvent = event as CloseEvent
    if (socket) detachListeners(socket)
    socket = null
    options.onClose?.(closeEvent)

    if (manuallyClosed || disposed) {
      statusRef.value = 'closed'
      return
    }

    const autoReconnect = options.autoReconnect ?? true
    if (autoReconnect === false) {
      statusRef.value = 'closed'
      return
    }

    const maxAttempts = typeof autoReconnect === 'object' ? autoReconnect.maxAttempts : undefined
    attemptRef.value += 1
    if (maxAttempts !== undefined && attemptRef.value > maxAttempts) {
      statusRef.value = 'closed'
      logger.warn(`giving up after ${maxAttempts} reconnect attempt(s)`)
      return
    }

    statusRef.value = 'reconnecting'
    const delay = computeReconnectDelay(attemptRef.value, options.backoff)
    logger.log(`reconnecting (attempt ${attemptRef.value}) in ${Math.round(delay)}ms`)
    reconnectTimer = setTimeout(connect, delay)
  }

  function connect(): void {
    if (disposed) return
    if (socket && isConnectingOrOpen(socket)) return
    clearReconnectTimer()
    manuallyClosed = false
    statusRef.value = attemptRef.value > 0 ? 'reconnecting' : 'connecting'

    const factory = options.createWebSocket ?? defaultCreateWebSocket
    let ws: WebSocket
    try {
      ws = factory(toValue(url), toValue(options.protocols))
    } catch (err) {
      errorRef.value = new EcosystemError('Failed to construct WebSocket', {
        code: 'realtime/socket-construct-error',
        cause: err,
      })
      statusRef.value = 'closed'
      logger.error('failed to construct socket', err)
      return
    }

    socket = ws
    ws.addEventListener('open', handleOpen)
    ws.addEventListener('message', handleMessage)
    ws.addEventListener('error', handleError)
    ws.addEventListener('close', handleClose)
  }

  function open(): void {
    attemptRef.value = 0
    manuallyClosed = false
    connect()
  }

  function close(code?: number, reason?: string): void {
    manuallyClosed = true
    clearReconnectTimer()
    attemptRef.value = 0
    clearQueue()
    if (socket && isConnectingOrOpen(socket)) {
      statusRef.value = 'closing'
      socket.close(code, reason)
    } else {
      statusRef.value = 'closed'
    }
  }

  function send(data: WebSocketMessage): boolean {
    if (socket && socket.readyState === READY_STATE_OPEN) {
      socket.send(data)
      return true
    }
    if (options.queueWhenOffline) enqueue(data)
    return false
  }

  if (options.immediate !== false) connect()

  registerDispose(() => {
    disposed = true
    manuallyClosed = true
    clearReconnectTimer()
    if (socket) {
      detachListeners(socket)
      try {
        socket.close()
      } catch {
        // Already closing/closed -- nothing to do.
      }
      socket = null
    }
  })

  return {
    status: computed(() => statusRef.value),
    data: computed(() => dataRef.value),
    error: computed(() => errorRef.value),
    reconnectAttempt: computed(() => attemptRef.value),
    queueLength: computed(() => queueLengthRef.value),
    send,
    open,
    close,
  }
}
