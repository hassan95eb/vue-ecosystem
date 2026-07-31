import {
  computed,
  getCurrentScope,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
  type ComputedRef,
} from 'vue'
import { createLogger, EcosystemError } from '@vue-ecosystem/core'
import type { ConnectionStatus } from './useWebSocket'

const logger = createLogger('realtime').extend('useChannel')

/**
 * Minimal shape `useChannel` needs from a connection. `UseWebSocketReturn`
 * satisfies this structurally -- it's declared separately, rather than this
 * composable requiring the full `UseWebSocketReturn`, so `useChannel` doesn't
 * hard-couple to `useWebSocket` specifically, and so tests can supply a
 * lightweight mock instead of a whole fake socket.
 */
export interface ChannelTransport {
  readonly status: ComputedRef<ConnectionStatus>
  readonly data: ComputedRef<unknown>
  readonly send: (data: string) => boolean
}

interface ChannelEnvelope {
  readonly type: string
  readonly channel: string
  readonly payload?: unknown
}

function isChannelEnvelope(value: unknown): value is ChannelEnvelope {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.type === 'string' && typeof record.channel === 'string'
}

export interface UseChannelOptions {
  readonly onMessage?: (payload: unknown) => void
  readonly onPresence?: (members: readonly string[]) => void
  readonly onError?: (error: EcosystemError) => void
}

export interface UseChannelReturn {
  /** Presence roster for this channel; stays empty unless the server sends `presence` envelopes. */
  readonly members: ComputedRef<readonly string[]>
  /** Payload of the most recent `message` envelope for this channel; `null` before the first one. */
  readonly lastMessage: ComputedRef<unknown>
  /** Set from a server-sent `error` envelope for this channel; cleared on the next successful (re-)subscribe. */
  readonly error: ComputedRef<EcosystemError | null>
  /**
   * `true` once a subscribe envelope has been sent while the connection is
   * open. Best-effort: the MVP protocol has no subscribe acknowledgement, so
   * this does not confirm the server actually accepted it.
   */
  readonly subscribed: ComputedRef<boolean>
  /** Publish a payload on this channel. Returns `false` (never throws) if the connection isn't open. */
  readonly publish: (payload: unknown) => boolean
}

/**
 * Multiplexes a named pub/sub + presence channel over a single connection
 * (typically `useWebSocket`), using this package's own JSON envelope
 * protocol -- not a standard, so the server has to speak it:
 *
 * - client -> server: `{ type: 'subscribe' | 'unsubscribe' | 'publish', channel, payload? }`
 * - server -> client: `{ type: 'message' | 'presence' | 'error', channel, payload? }`
 *   - `message` payload: whatever was published
 *   - `presence` payload: `{ members: string[] }`
 *   - `error` payload: `{ message: string }`
 *
 * See this package's README for a minimal reference server. Automatically
 * (re-)subscribes whenever the connection's `status` becomes `'open'` --
 * including after a reconnect, since the server won't remember a
 * subscription across a dropped connection -- and sends `unsubscribe` on
 * disposal if still connected.
 *
 * Multiple `useChannel` calls can share one `useWebSocket` connection; each
 * only reacts to envelopes addressed to its own `channel` name.
 *
 * ```ts
 * const socket = useWebSocket('wss://example.com/socket')
 * const room = useChannel(socket, 'room:42')
 *
 * watch(room.lastMessage, (payload) => console.log(payload))
 * room.publish({ text: 'hi' })
 * ```
 */
export function useChannel(
  connection: ChannelTransport,
  channel: string,
  options: UseChannelOptions = {},
): UseChannelReturn {
  const membersRef = ref<readonly string[]>([])
  const lastMessageRef = shallowRef<unknown>(null)
  const errorRef = shallowRef<EcosystemError | null>(null)
  const subscribedRef = ref(false)

  function sendEnvelope(envelope: ChannelEnvelope): boolean {
    return connection.send(JSON.stringify(envelope))
  }

  function subscribe(): void {
    if (connection.status.value !== 'open') return
    if (sendEnvelope({ type: 'subscribe', channel })) {
      errorRef.value = null
      subscribedRef.value = true
      logger.log(`subscribed to ${channel}`)
    }
  }

  function unsubscribe(): void {
    if (subscribedRef.value) {
      sendEnvelope({ type: 'unsubscribe', channel })
      logger.log(`unsubscribed from ${channel}`)
    }
    subscribedRef.value = false
  }

  function publish(payload: unknown): boolean {
    return sendEnvelope({ type: 'publish', channel, payload })
  }

  function handleEnvelope(parsed: ChannelEnvelope): void {
    if (parsed.type === 'message') {
      lastMessageRef.value = parsed.payload
      options.onMessage?.(parsed.payload)
    } else if (parsed.type === 'presence') {
      const payload = parsed.payload as { members?: unknown } | undefined
      const members = Array.isArray(payload?.members) ? (payload.members as string[]) : []
      membersRef.value = members
      options.onPresence?.(members)
    } else if (parsed.type === 'error') {
      const payload = parsed.payload as { message?: unknown } | undefined
      const wrapped = new EcosystemError(
        typeof payload?.message === 'string' ? payload.message : 'Channel error',
        { code: 'realtime/channel-error' },
      )
      errorRef.value = wrapped
      options.onError?.(wrapped)
    }
  }

  // `sync` flush here too: without it there's a window -- one microtask wide,
  // between the connection reporting `status === 'open'` and this callback
  // actually running -- where a caller reacting to `status` themselves could
  // call `publish()` before the subscribe envelope has gone out.
  const stopStatusWatch = watch(
    connection.status,
    (status, previousStatus) => {
      if (status === 'open') {
        subscribe()
      } else if (previousStatus === 'open') {
        // The connection dropped from under us -- the server won't remember our
        // subscription once it reconnects, so we don't consider ourselves subscribed either.
        subscribedRef.value = false
      }
    },
    { immediate: true, flush: 'sync' },
  )

  // `sync` flush: `connection.data` holds only the latest message, so a batched
  // ('pre') watcher can miss an intermediate one if two envelopes arrive in the
  // same tick (the real socket handler that sets `data` is itself synchronous).
  const stopDataWatch = watch(
    connection.data,
    (raw) => {
      if (typeof raw !== 'string') return
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        return // not JSON -- not one of ours
      }
      if (!isChannelEnvelope(parsed) || parsed.channel !== channel) return
      handleEnvelope(parsed)
    },
    { flush: 'sync' },
  )

  function registerDispose(fn: () => void): void {
    if (getCurrentScope()) onScopeDispose(fn)
  }

  registerDispose(() => {
    stopStatusWatch()
    stopDataWatch()
    unsubscribe()
  })

  return {
    members: computed(() => membersRef.value),
    lastMessage: computed(() => lastMessageRef.value),
    error: computed(() => errorRef.value),
    subscribed: computed(() => subscribedRef.value),
    publish,
  }
}
