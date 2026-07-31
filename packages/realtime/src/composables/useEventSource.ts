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
import type { ConnectionStatus } from './useWebSocket'

const logger = createLogger('realtime').extend('useEventSource')

export interface UseEventSourceOptions {
  /** Forwarded to the `EventSource` constructor. Default `false`. */
  readonly withCredentials?: MaybeRefOrGetter<boolean | undefined>
  /** Connect immediately when the composable runs. Default `true`. */
  readonly immediate?: boolean
  /**
   * Reconnect automatically after a drop. Default `true`. Pass `{ maxAttempts }`
   * to give up after N consecutive failed attempts; `false` to disable.
   *
   * Native `EventSource` reconnects on its own, but with no control over
   * timing and no visibility into the attempt count. This composable takes
   * over reconnection entirely -- on every `error` event the underlying
   * `EventSource` is closed and a fresh one is scheduled through the same
   * backoff used by `useWebSocket`, so the two composables behave the same
   * way and expose the same `status` / `reconnectAttempt` shape.
   */
  readonly autoReconnect?: boolean | { readonly maxAttempts?: number }
  /** Exponential-backoff tuning for the reconnect delay. See `computeReconnectDelay`. */
  readonly backoff?: BackoffOptions
  /**
   * Named SSE events to subscribe to beyond the default `message` event
   * (`event: <name>` in the wire format), keyed by event name. Re-attached on
   * every reconnect along with the built-in listeners.
   */
  readonly events?: Readonly<Record<string, (event: MessageEvent) => void>>
  /** Factory producing the underlying source. Defaults to the global `EventSource` constructor. Override in tests or non-browser runtimes. */
  readonly createEventSource?: (url: string, withCredentials?: boolean) => EventSource
  readonly onOpen?: (event: Event) => void
  readonly onMessage?: (event: MessageEvent) => void
  readonly onError?: (event: Event) => void
}

export interface UseEventSourceReturn {
  readonly status: ComputedRef<ConnectionStatus>
  /** Payload of the most recently received `message` event; `null` before the first one. */
  readonly data: ComputedRef<unknown>
  /** Set when a source-level error fires; cleared on the next successful open. */
  readonly error: ComputedRef<EcosystemError | null>
  /** `0` while idle, connecting or open; the 1-based count of consecutive reconnect attempts otherwise. */
  readonly reconnectAttempt: ComputedRef<number>
  /** (Re)connect, resetting the reconnect-attempt counter. No-op if already open or connecting. */
  readonly open: () => void
  /** Close the source and cancel any pending auto-reconnect. */
  readonly close: () => void
}

function defaultCreateEventSource(url: string, withCredentials?: boolean): EventSource {
  return new EventSource(url, { withCredentials })
}

// `EventSource.readyState` values, inlined for the same reason `useWebSocket`
// inlines its own -- fixed by the WHATWG spec, and it means this module never
// touches the global `EventSource` object except inside `defaultCreateEventSource`.
const READY_STATE_CONNECTING = 0
const READY_STATE_OPEN = 1

/** `true` while a source is still usable -- already open, or in the middle of opening. */
function isConnectingOrOpen(es: EventSource): boolean {
  return es.readyState === READY_STATE_OPEN || es.readyState === READY_STATE_CONNECTING
}

function registerDispose(fn: () => void): void {
  if (getCurrentScope()) {
    onScopeDispose(fn)
  }
}

/**
 * Reactive Server-Sent Events connection with exponential-backoff auto-reconnect.
 *
 * ```ts
 * const { status, data } = useEventSource('/api/stream')
 *
 * watch(data, (payload) => console.log('received', payload))
 * ```
 *
 * For named events (`event: priceUpdate` in the wire format), use `events`:
 *
 * ```ts
 * useEventSource('/api/stream', {
 *   events: { priceUpdate: (event) => console.log(event.data) },
 * })
 * ```
 */
export function useEventSource(
  url: MaybeRefOrGetter<string>,
  options: UseEventSourceOptions = {},
): UseEventSourceReturn {
  const statusRef = ref<ConnectionStatus>('idle')
  const dataRef = shallowRef<unknown>(null)
  const errorRef = shallowRef<EcosystemError | null>(null)
  const attemptRef = ref(0)

  let source: EventSource | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let manuallyClosed = false
  let disposed = false

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function detachListeners(es: EventSource): void {
    es.removeEventListener('open', handleOpen)
    es.removeEventListener('message', handleMessage)
    es.removeEventListener('error', handleError)
    for (const [name, handler] of Object.entries(options.events ?? {})) {
      es.removeEventListener(name, handler as EventListener)
    }
  }

  function handleOpen(event: Event): void {
    statusRef.value = 'open'
    attemptRef.value = 0
    errorRef.value = null
    logger.log('open')
    options.onOpen?.(event)
  }

  function handleMessage(event: Event): void {
    const messageEvent = event as MessageEvent
    dataRef.value = messageEvent.data
    options.onMessage?.(messageEvent)
  }

  function scheduleReconnectOrGiveUp(): void {
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

  function handleError(event: Event): void {
    errorRef.value = new EcosystemError('EventSource error', { code: 'realtime/source-error' })
    logger.error('source error', event)
    options.onError?.(event)

    // Native EventSource retries on its own; we take over entirely so `status`
    // and `reconnectAttempt` stay accurate and backoff-controlled.
    if (source) {
      detachListeners(source)
      source.close()
    }
    source = null

    if (manuallyClosed || disposed) {
      statusRef.value = 'closed'
      return
    }
    scheduleReconnectOrGiveUp()
  }

  function connect(): void {
    if (disposed) return
    if (source && isConnectingOrOpen(source)) return
    clearReconnectTimer()
    manuallyClosed = false
    statusRef.value = attemptRef.value > 0 ? 'reconnecting' : 'connecting'

    const factory = options.createEventSource ?? defaultCreateEventSource
    let es: EventSource
    try {
      es = factory(toValue(url), toValue(options.withCredentials))
    } catch (err) {
      errorRef.value = new EcosystemError('Failed to construct EventSource', {
        code: 'realtime/source-construct-error',
        cause: err,
      })
      statusRef.value = 'closed'
      logger.error('failed to construct source', err)
      return
    }

    source = es
    es.addEventListener('open', handleOpen)
    es.addEventListener('message', handleMessage)
    es.addEventListener('error', handleError)
    for (const [name, handler] of Object.entries(options.events ?? {})) {
      es.addEventListener(name, handler as EventListener)
    }
  }

  function open(): void {
    attemptRef.value = 0
    manuallyClosed = false
    connect()
  }

  function close(): void {
    manuallyClosed = true
    clearReconnectTimer()
    attemptRef.value = 0
    if (source) {
      detachListeners(source)
      source.close()
      source = null
    }
    statusRef.value = 'closed'
  }

  if (options.immediate !== false) connect()

  registerDispose(() => {
    disposed = true
    manuallyClosed = true
    clearReconnectTimer()
    if (source) {
      detachListeners(source)
      source.close()
      source = null
    }
  })

  return {
    status: computed(() => statusRef.value),
    data: computed(() => dataRef.value),
    error: computed(() => errorRef.value),
    reconnectAttempt: computed(() => attemptRef.value),
    open,
    close,
  }
}
