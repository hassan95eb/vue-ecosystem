import type { Ref, ComputedRef } from 'vue'

/** A value, a ref of it, or a getter for it -- the standard composable input shape. */
export type MaybeRefOrGetter<T> = T | Ref<T> | (() => T)

/** Read-only reactive value returned from a composable. */
export type ReadonlyRef<T> = ComputedRef<T>

/** Recursive readonly, for options objects a composable must not mutate. */
export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T

/** Discriminated result type, for APIs where throwing would be the wrong shape. */
export type Result<T, E = EcosystemErrorLike> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }

/** Structural view of an ecosystem error, usable without importing the class. */
export interface EcosystemErrorLike {
  readonly name: string
  readonly message: string
  readonly code: string
}

/** Every package exposes its options object through this shape. */
export interface PackageMeta {
  readonly name: string
  readonly version: string
}
