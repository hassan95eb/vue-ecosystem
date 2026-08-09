/**
 * The AST, the field schema, and the type-level rules that connect them.
 *
 * No Vue import lives in this file, or anywhere else under `internal/`. The
 * composable in `../composables/useQueryBuilder.ts` is the only reactive glue;
 * everything that can be decided from a schema and a plain object is decided
 * here, so it is testable without mounting anything. This mirrors the
 * pure-core / composable-wrapper split established by `persian-tools` and
 * `virtual-scroll` -- see CONTRIBUTING.md, "Framework-agnostic core".
 *
 * ## The AST is plain JSON, deliberately
 *
 * Every node is a plain object of strings, numbers, booleans and arrays. No
 * class instances, no functions, no symbols, no `Date`. That is what makes
 * `JSON.parse(JSON.stringify(ast))` deep-equal the original, which in turn is
 * what makes a saved view, a URL fragment or a row in a database a viable place
 * to keep a query. Dates are therefore carried as ISO 8601 **strings**, and the
 * unary operators (`isNull` / `isNotNull`) omit the `value` key entirely rather
 * than setting it to `undefined` -- `JSON.stringify` drops `undefined`
 * properties, so keeping the key would break the round trip.
 */

import { invalidSchema } from './errors'

// --- Field schema -------------------------------------------------------

export type FieldKind = 'string' | 'number' | 'boolean' | 'date' | 'enum'

export type FieldDef =
  | { readonly kind: 'string'; readonly label?: string }
  | { readonly kind: 'number'; readonly label?: string }
  | { readonly kind: 'boolean'; readonly label?: string }
  | { readonly kind: 'date'; readonly label?: string }
  | { readonly kind: 'enum'; readonly values: readonly string[]; readonly label?: string }

export type Schema = Readonly<Record<string, FieldDef>>

/**
 * Identity function whose only job is to preserve literal types.
 *
 * `const` type parameters keep `{ kind: 'enum', values: ['open', 'closed'] }`
 * from widening to `string[]`, which is what lets the builder offer `'open'`
 * and `'closed'` as autocomplete on the value argument instead of `string`.
 *
 * It also validates at runtime, because a schema is frequently assembled from
 * a column definition someone wrote by hand.
 *
 * @throws {@link QueryBuilderError} `query-builder/invalid-schema`
 */
export function defineSchema<const S extends Schema>(schema: S): S {
  for (const [field, def] of Object.entries(schema)) {
    if (def.kind === 'enum') {
      if (!Array.isArray(def.values) || def.values.length === 0) {
        throw invalidSchema(field, 'an enum field needs a non-empty `values` array')
      }
      if (def.values.some((v) => typeof v !== 'string')) {
        throw invalidSchema(field, 'enum `values` must all be strings')
      }
    }
  }
  return schema
}

// --- Operators ----------------------------------------------------------

/** Operators taking exactly one scalar operand. */
export type ScalarOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'before'
  | 'after'
  | 'onOrBefore'
  | 'onOrAfter'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'

/** Operators taking an array of operands. */
export type ListOperator = 'in' | 'notIn'

/** Operators taking an inclusive `[min, max]` pair. */
export type RangeOperator = 'between'

/** Operators taking no operand at all -- the `value` key is absent on the node. */
export type UnaryOperator = 'isNull' | 'isNotNull'

export type Operator = ScalarOperator | ListOperator | RangeOperator | UnaryOperator

/**
 * Which operators each field kind accepts. This single table is the source of
 * truth for **both** layers: the type-level rules below index into it, and
 * `parse()` reads {@link OPERATORS_BY_KIND} at runtime. There is no second list
 * to keep in sync, which is the only way a "number fields reject `contains`"
 * rule stays true a year from now.
 */
export interface OperatorsFor {
  string:
    | 'eq'
    | 'neq'
    | 'contains'
    | 'notContains'
    | 'startsWith'
    | 'endsWith'
    | ListOperator
    | UnaryOperator
  number: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | RangeOperator | ListOperator | UnaryOperator
  boolean: 'eq' | 'neq' | UnaryOperator
  date:
    'eq' | 'neq' | 'before' | 'after' | 'onOrBefore' | 'onOrAfter' | RangeOperator | UnaryOperator
  enum: 'eq' | 'neq' | ListOperator | UnaryOperator
}

/** Runtime mirror of {@link OperatorsFor}. Kept adjacent so drift is visible. */
export const OPERATORS_BY_KIND: {
  readonly [K in FieldKind]: readonly OperatorsFor[K][]
} = {
  string: [
    'eq',
    'neq',
    'contains',
    'notContains',
    'startsWith',
    'endsWith',
    'in',
    'notIn',
    'isNull',
    'isNotNull',
  ],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'notIn', 'isNull', 'isNotNull'],
  boolean: ['eq', 'neq', 'isNull', 'isNotNull'],
  date: [
    'eq',
    'neq',
    'before',
    'after',
    'onOrBefore',
    'onOrAfter',
    'between',
    'isNull',
    'isNotNull',
  ],
  enum: ['eq', 'neq', 'in', 'notIn', 'isNull', 'isNotNull'],
}

export const UNARY_OPERATORS: readonly UnaryOperator[] = ['isNull', 'isNotNull']
export const LIST_OPERATORS: readonly ListOperator[] = ['in', 'notIn']
export const RANGE_OPERATORS: readonly RangeOperator[] = ['between']

export function isUnaryOperator(op: string): op is UnaryOperator {
  return (UNARY_OPERATORS as readonly string[]).includes(op)
}

export function isListOperator(op: string): op is ListOperator {
  return (LIST_OPERATORS as readonly string[]).includes(op)
}

export function isRangeOperator(op: string): op is RangeOperator {
  return (RANGE_OPERATORS as readonly string[]).includes(op)
}

// --- Values -------------------------------------------------------------

/**
 * The JSON value type a field kind carries in the AST.
 *
 * `date` is a **string**: an ISO 8601 instant. A `Date` instance would not
 * survive the round trip, and an epoch number would be indistinguishable from
 * a `number` field once serialised.
 */
export type FieldValue<D extends FieldDef> = D extends { readonly kind: 'enum' }
  ? D extends { readonly values: readonly (infer V extends string)[] }
    ? V
    : string
  : D extends { readonly kind: 'number' }
    ? number
    : D extends { readonly kind: 'boolean' }
      ? boolean
      : string

/** The value type for a kind, without a schema in hand. Used by the AST types. */
export interface ValueForKind {
  string: string
  number: number
  boolean: boolean
  date: string
  enum: string
}

// --- Nodes --------------------------------------------------------------

/**
 * A single comparison.
 *
 * Distributes over {@link FieldKind}, so the union only ever contains
 * kind/operator pairs the table above permits. Arms whose `Extract<...>`
 * resolves to `never` collapse to `operator: never` and are therefore
 * uninhabited -- that is how `{ kind: 'number', operator: 'contains' }` becomes
 * a compile error rather than a runtime one.
 */
export type Condition<K extends FieldKind = FieldKind> = K extends FieldKind
  ? | {
        readonly type: 'condition'
        readonly field: string
        readonly kind: K
        readonly operator: Extract<OperatorsFor[K], ScalarOperator>
        readonly value: ValueForKind[K]
      }
    | {
        readonly type: 'condition'
        readonly field: string
        readonly kind: K
        readonly operator: Extract<OperatorsFor[K], ListOperator>
        readonly value: readonly ValueForKind[K][]
      }
    | {
        readonly type: 'condition'
        readonly field: string
        readonly kind: K
        readonly operator: Extract<OperatorsFor[K], RangeOperator>
        readonly value: readonly [ValueForKind[K], ValueForKind[K]]
      }
    | {
        readonly type: 'condition'
        readonly field: string
        readonly kind: K
        readonly operator: Extract<OperatorsFor[K], UnaryOperator>
      }
  : never

export type Combinator = 'and' | 'or'

export interface Group {
  readonly type: 'group'
  readonly combinator: Combinator
  /** Always present, never optional -- an absent key and `false` must not both mean "not negated". */
  readonly negate: boolean
  readonly children: readonly QueryNode[]
}

export type QueryNode = Condition | Group

/**
 * The root of a query is always a group, never a bare condition.
 *
 * One root shape means consumers never branch on "is the root a condition?",
 * and the composable's node paths are uniformly "indexes into `children`".
 * A single condition is just a group of one.
 */
export type QueryAst = Group

export function isGroup(node: QueryNode): node is Group {
  return node.type === 'group'
}

export function isCondition(node: QueryNode): node is Condition {
  return node.type === 'condition'
}

/** An empty `and` group -- the identity query, which matches every record. */
export function emptyQuery(combinator: Combinator = 'and'): QueryAst {
  return { type: 'group', combinator, negate: false, children: [] }
}
