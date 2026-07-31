// Public API surface. No logic here by design -- the exports map and the
// `internal/` boundary lint rule both point at exactly this file.

export { useWebSocket } from './composables/useWebSocket'
export type {
  ConnectionStatus,
  UseWebSocketOptions,
  UseWebSocketReturn,
  WebSocketMessage,
} from './composables/useWebSocket'

export { useEventSource } from './composables/useEventSource'
export type { UseEventSourceOptions, UseEventSourceReturn } from './composables/useEventSource'

export { useOptimistic } from './composables/useOptimistic'
export type { UseOptimisticOptions, UseOptimisticReturn } from './composables/useOptimistic'

export { useChannel } from './composables/useChannel'
export type {
  ChannelTransport,
  UseChannelOptions,
  UseChannelReturn,
} from './composables/useChannel'

export { computeReconnectDelay } from './internal/backoff'
export type { BackoffOptions } from './internal/backoff'
