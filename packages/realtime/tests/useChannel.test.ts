import { computed, effectScope, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useChannel } from '../src/composables/useChannel'
import type { ChannelTransport } from '../src/composables/useChannel'
import type { ConnectionStatus } from '../src/composables/useWebSocket'

/**
 * A minimal fake satisfying `ChannelTransport` -- a `send` spy that only
 * "delivers" while `status` is `'open'`, mirroring how a real `useWebSocket`
 * connection would behave. `statusRef`/`dataRef` are the mutable refs a test
 * drives directly; `transport` is the read-only-shaped object passed to
 * `useChannel`, matching what `useWebSocket` itself would hand back
 * (`ComputedRef`s, not plain `Ref`s).
 */
function createMockTransport(): {
  transport: ChannelTransport
  statusRef: { value: ConnectionStatus }
  dataRef: { value: unknown }
  sent: string[]
} {
  const statusRef = ref<ConnectionStatus>('idle')
  const dataRef = ref<unknown>(null)
  const sent: string[] = []

  const transport: ChannelTransport = {
    status: computed(() => statusRef.value),
    data: computed(() => dataRef.value),
    send: vi.fn((raw: string) => {
      if (statusRef.value !== 'open') return false
      sent.push(raw)
      return true
    }),
  }

  return { transport, statusRef, dataRef, sent }
}

/** Push a server envelope through the transport's `data`, as JSON text (what a real WebSocket message would carry). */
function pushEnvelope(dataRef: { value: unknown }, envelope: Record<string, unknown>): void {
  dataRef.value = JSON.stringify(envelope)
}

describe('useChannel', () => {
  it('subscribes once the connection is open, and unsubscribes on dispose', () => {
    const { transport, statusRef, sent } = createMockTransport()
    const scope = effectScope()
    let channel: ReturnType<typeof useChannel>

    scope.run(() => {
      channel = useChannel(transport, 'room:1')
    })

    expect(channel!.subscribed.value).toBe(false)
    expect(sent).toHaveLength(0)

    statusRef.value = 'open'
    expect(channel!.subscribed.value).toBe(true)
    expect(sent).toEqual([JSON.stringify({ type: 'subscribe', channel: 'room:1' })])

    scope.stop()
    expect(sent).toEqual([
      JSON.stringify({ type: 'subscribe', channel: 'room:1' }),
      JSON.stringify({ type: 'unsubscribe', channel: 'room:1' }),
    ])
  })

  it('subscribes immediately if the connection is already open when created', () => {
    const { transport, statusRef } = createMockTransport()
    statusRef.value = 'open'

    const scope = effectScope()
    scope.run(() => {
      const channel = useChannel(transport, 'room:1')
      expect(channel.subscribed.value).toBe(true)
    })
    scope.stop()
  })

  it('does not send unsubscribe on dispose if never subscribed', () => {
    const { transport, sent } = createMockTransport()
    const scope = effectScope()
    scope.run(() => {
      useChannel(transport, 'room:1') // never opens
    })
    scope.stop()
    expect(sent).toHaveLength(0)
  })

  it('routes message envelopes only to the matching channel', () => {
    const { transport, statusRef, dataRef } = createMockTransport()
    statusRef.value = 'open'

    const scope = effectScope()
    scope.run(() => {
      const room1 = useChannel(transport, 'room:1')
      const room2 = useChannel(transport, 'room:2')

      pushEnvelope(dataRef, { type: 'message', channel: 'room:1', payload: { text: 'hi' } })
      expect(room1.lastMessage.value).toEqual({ text: 'hi' })
      expect(room2.lastMessage.value).toBe(null)

      pushEnvelope(dataRef, { type: 'message', channel: 'room:2', payload: { text: 'yo' } })
      expect(room2.lastMessage.value).toEqual({ text: 'yo' })
      expect(room1.lastMessage.value).toEqual({ text: 'hi' }) // unchanged
    })
    scope.stop()
  })

  it('tracks the presence roster from presence envelopes', () => {
    const onPresence = vi.fn()
    const { transport, statusRef, dataRef } = createMockTransport()
    statusRef.value = 'open'

    const scope = effectScope()
    scope.run(() => {
      const room = useChannel(transport, 'room:1', { onPresence })

      pushEnvelope(dataRef, {
        type: 'presence',
        channel: 'room:1',
        payload: { members: ['alice', 'bob'] },
      })

      expect(room.members.value).toEqual(['alice', 'bob'])
      expect(onPresence).toHaveBeenCalledWith(['alice', 'bob'])
    })
    scope.stop()
  })

  it('publish() sends a publish envelope and returns false when not open', () => {
    const { transport, statusRef, sent } = createMockTransport()
    const scope = effectScope()
    scope.run(() => {
      const room = useChannel(transport, 'room:1')

      expect(room.publish({ text: 'too soon' })).toBe(false)

      statusRef.value = 'open'
      expect(room.publish({ text: 'hi' })).toBe(true)
      expect(sent.at(-1)).toBe(
        JSON.stringify({ type: 'publish', channel: 'room:1', payload: { text: 'hi' } }),
      )
    })
    scope.stop()
  })

  it('resubscribes after a reconnect', () => {
    const { transport, statusRef, sent } = createMockTransport()
    const scope = effectScope()
    let channel: ReturnType<typeof useChannel>

    scope.run(() => {
      channel = useChannel(transport, 'room:1')
    })

    statusRef.value = 'open'
    expect(channel!.subscribed.value).toBe(true)

    statusRef.value = 'reconnecting'
    expect(channel!.subscribed.value).toBe(false) // server won't remember us across the drop

    statusRef.value = 'open'
    expect(channel!.subscribed.value).toBe(true)
    expect(sent.filter((m) => m.includes('subscribe') && !m.includes('un'))).toHaveLength(2)

    scope.stop()
  })

  it('surfaces server-sent error envelopes', () => {
    const onError = vi.fn()
    const { transport, statusRef, dataRef } = createMockTransport()
    statusRef.value = 'open'

    const scope = effectScope()
    scope.run(() => {
      const room = useChannel(transport, 'room:1', { onError })

      pushEnvelope(dataRef, {
        type: 'error',
        channel: 'room:1',
        payload: { message: 'not authorized' },
      })

      expect(room.error.value?.code).toBe('realtime/channel-error')
      expect(room.error.value?.message).toBe('not authorized')
      expect(onError).toHaveBeenCalledWith(room.error.value)
    })
    scope.stop()
  })

  it('ignores non-JSON data and envelopes for a different channel without throwing', () => {
    const { transport, statusRef, dataRef } = createMockTransport()
    statusRef.value = 'open'

    const scope = effectScope()
    scope.run(() => {
      const room = useChannel(transport, 'room:1')

      expect(() => {
        dataRef.value = 'not json at all'
      }).not.toThrow()
      expect(room.lastMessage.value).toBe(null)

      pushEnvelope(dataRef, { type: 'message', channel: 'some-other-room', payload: 'x' })
      expect(room.lastMessage.value).toBe(null)

      dataRef.value = 42 // not even a string
      expect(room.lastMessage.value).toBe(null)
    })
    scope.stop()
  })
})
