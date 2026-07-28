// Public API surface. No logic lives in this file by design -- it exists so the
// exports map and the boundary lint rule have exactly one thing to point at.

export { EcosystemError, isEcosystemError, ECOSYSTEM_ERROR_TAG } from './errors'
export type { EcosystemErrorOptions } from './errors'

export { createLogger } from './logger'
export type { Logger } from './logger'

export type {
  MaybeRefOrGetter,
  ReadonlyRef,
  DeepReadonly,
  Result,
  EcosystemErrorLike,
  PackageMeta,
} from './types'
