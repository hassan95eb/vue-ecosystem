/**
 * `evaluate(ast, record)` -- the reason this package exists as a dependency
 * rather than as a UI.
 *
 * `smart-table` needs to decide, for one row, whether a filter tree matches.
 * If that traversal were written inline there, every other consumer would write
 * it again and each copy would answer the null/undefined and case-sensitivity
 * questions slightly differently. It lives here, once, with the semantics
 * written down in the package README and pinned by a table-driven test.
 *
 * ## Semantics, in short (the README has the reasoning)
 *
 * - **Missing values.** `null`, `undefined` and an absent key are one thing:
 *   *missing*. A missing value matches `isNull` and **nothing else** -- not
 *   `neq`, not `notContains`, not `notIn`. There is no three-valued logic:
 *   every condition returns a plain boolean.
 * - **Strings** compare case-**insensitively** by default (`caseSensitive: true`
 *   opts out). `enum` values always compare exactly -- they are identifiers.
 * - **Empty groups are true**, for both combinators. An empty filter is not a
 *   filter.
 * - **Dates** compare as absolute instants, never as strings. No truncation to
 *   a day: use `between` for that.
 * - **`between` is inclusive** at both ends.
 * - A record value of the wrong runtime type for its field kind never matches.
 */

import {
  isGroup,
  type Condition,
  type FieldKind,
  type Group,
  type QueryAst,
  type QueryNode,
} from './ast'
import { unsupportedOperator } from './errors'
import { parseInstant } from './serialise'

export interface EvaluateOptions {
  /**
   * Compare `string`-kind values case-sensitively. Defaults to `false`.
   *
   * The default is the one a filter UI wants: a "contains" box that misses
   * `Ali` because the user typed `ali` is a bug report, not a feature. Folding
   * uses `String.prototype.toLowerCase()`, which is locale-independent, rather
   * than `toLocaleLowerCase()`, so the same query gives the same answer on
   * every machine.
   */
  readonly caseSensitive?: boolean
}

/** A plain row. Values may be anything; type mismatches are handled, not thrown. */
export type QueryRecord = Readonly<Record<string, unknown>>

/**
 * Does `record` match `ast`?
 *
 * Pure and framework-agnostic -- no Vue import, no I/O, no mutation of either
 * argument. Never throws for arbitrary *record* data; it throws only if the AST
 * itself carries an operator that neither the builder nor `parse()` could have
 * produced.
 *
 * ```ts
 * evaluate(ast, { name: 'Ada', age: 36 })
 * ```
 *
 * @throws {@link QueryBuilderError} `query-builder/unsupported-operator`
 */
export function evaluate(
  ast: QueryAst,
  record: QueryRecord,
  options: EvaluateOptions = {},
): boolean {
  return evaluateNode(ast, record, options.caseSensitive === true)
}

function evaluateNode(node: QueryNode, record: QueryRecord, caseSensitive: boolean): boolean {
  return isGroup(node)
    ? evaluateGroup(node, record, caseSensitive)
    : evaluateCondition(node, record, caseSensitive)
}

function evaluateGroup(group: Group, record: QueryRecord, caseSensitive: boolean): boolean {
  // An empty group is vacuously true for BOTH combinators. For `and` that is
  // the algebraic identity; for `or` it deliberately is not (the identity would
  // be `false`). The reason is that the empty group is the initial state of
  // every filter UI, and a filter builder that hides every row until you add a
  // rule is broken. "No rules" means "no filtering", whichever combinator is
  // selected.
  const result =
    group.children.length === 0
      ? true
      : group.combinator === 'and'
        ? group.children.every((child) => evaluateNode(child, record, caseSensitive))
        : group.children.some((child) => evaluateNode(child, record, caseSensitive))

  return group.negate ? !result : result
}

function evaluateCondition(
  condition: Condition,
  record: QueryRecord,
  caseSensitive: boolean,
): boolean {
  const { field, kind } = condition

  // The `Condition` union has one member per legal (kind, operator) pair, which
  // is exactly what makes the *builder* type-safe -- but narrowing it back down
  // through a 15-arm switch produces union-of-array-signatures errors on
  // `.some()` and buys nothing here. Validation already happened, in the type
  // system at construction time and in `parse()` at the boundary; the operand
  // is read as `unknown` and re-checked, so `evaluate` stays total for any
  // record shape.
  const operator: string = condition.operator
  const operand: unknown = (condition as { readonly value?: unknown }).value

  const raw = Object.prototype.hasOwnProperty.call(record, field) ? record[field] : undefined
  const missing = raw === null || raw === undefined

  if (operator === 'isNull') return missing
  if (operator === 'isNotNull') return !missing

  // Every remaining operator is a comparison, and there is nothing to compare a
  // missing value against. Returning `false` (rather than propagating an
  // "unknown") is what keeps the return type a plain boolean and keeps
  // `not(group)` an honest inversion.
  if (missing) return false

  const left = coerce(raw, kind)
  if (left === null) return false // present, but the wrong runtime type for the field

  switch (operator) {
    case 'eq':
      return equals(left, operand, kind, caseSensitive)
    case 'neq':
      return !equals(left, operand, kind, caseSensitive)

    case 'in':
      return toArray(operand).some((v) => equals(left, v, kind, caseSensitive))
    case 'notIn':
      return !toArray(operand).some((v) => equals(left, v, kind, caseSensitive))

    case 'gt':
      return compareNumber(left, operand, (a, b) => a > b)
    case 'gte':
      return compareNumber(left, operand, (a, b) => a >= b)
    case 'lt':
      return compareNumber(left, operand, (a, b) => a < b)
    case 'lte':
      return compareNumber(left, operand, (a, b) => a <= b)

    case 'before':
      return compareInstant(left, operand, (a, b) => a < b)
    case 'after':
      return compareInstant(left, operand, (a, b) => a > b)
    case 'onOrBefore':
      return compareInstant(left, operand, (a, b) => a <= b)
    case 'onOrAfter':
      return compareInstant(left, operand, (a, b) => a >= b)

    case 'between':
      return between(left, operand, kind)

    case 'contains':
      return matchText(left, operand, caseSensitive, (a, b) => a.includes(b))
    case 'notContains':
      return matchText(left, operand, caseSensitive, (a, b) => !a.includes(b))
    case 'startsWith':
      return matchText(left, operand, caseSensitive, (a, b) => a.startsWith(b))
    case 'endsWith':
      return matchText(left, operand, caseSensitive, (a, b) => a.endsWith(b))

    default:
      // Only reachable if the AST bypassed both the builder and `parse()`.
      throw unsupportedOperator(operator)
  }
}

function toArray(operand: unknown): readonly unknown[] {
  return Array.isArray(operand) ? operand : []
}

function compareNumber(
  left: string | number | boolean,
  operand: unknown,
  compare: (a: number, b: number) => boolean,
): boolean {
  return typeof left === 'number' && typeof operand === 'number' && compare(left, operand)
}

function matchText(
  left: string | number | boolean,
  operand: unknown,
  caseSensitive: boolean,
  compare: (haystack: string, needle: string) => boolean,
): boolean {
  if (typeof left !== 'string' || typeof operand !== 'string') return false
  return compare(fold(left, caseSensitive), fold(operand, caseSensitive))
}

/**
 * Normalise a record value into the comparable form for its field kind, or
 * `null` when the runtime type does not match the declared kind.
 *
 * `date` is the one kind that accepts more than one input shape, because a row
 * arriving from an ORM, from `JSON.parse` and from a fixture will legitimately
 * carry a `Date`, an ISO string and an epoch number respectively.
 */
function coerce(raw: unknown, kind: FieldKind): string | number | boolean | null {
  switch (kind) {
    case 'string':
    case 'enum':
      return typeof raw === 'string' ? raw : null
    case 'number':
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
    case 'boolean':
      return typeof raw === 'boolean' ? raw : null
    case 'date':
      // A present-but-unparseable date is a non-match, not a `null` match:
      // the field *has* a value, it is just not a date.
      return parseInstant(raw)
  }
}

function equals(
  left: string | number | boolean,
  right: unknown,
  kind: FieldKind,
  caseSensitive: boolean,
): boolean {
  if (kind === 'date') {
    const rightInstant = parseInstant(right)
    return rightInstant !== null && left === rightInstant
  }
  if (kind === 'string' && typeof left === 'string' && typeof right === 'string') {
    return fold(left, caseSensitive) === fold(right, caseSensitive)
  }
  // `enum`, `number`, `boolean`: exact. Enum members are identifiers, not
  // prose, so folding their case would make 'Open' and 'open' the same member.
  return left === right
}

function compareInstant(
  left: string | number | boolean,
  right: unknown,
  compare: (a: number, b: number) => boolean,
): boolean {
  const rightInstant = parseInstant(right)
  return typeof left === 'number' && rightInstant !== null && compare(left, rightInstant)
}

function between(left: string | number | boolean, operand: unknown, kind: FieldKind): boolean {
  if (typeof left !== 'number') return false
  if (!Array.isArray(operand) || operand.length !== 2) return false

  const rawMin: unknown = operand[0]
  const rawMax: unknown = operand[1]
  const min = kind === 'date' ? parseInstant(rawMin) : typeof rawMin === 'number' ? rawMin : null
  const max = kind === 'date' ? parseInstant(rawMax) : typeof rawMax === 'number' ? rawMax : null
  if (min === null || max === null) return false

  // Inclusive at both ends, and tolerant of reversed bounds: a two-handle range
  // slider produces `[max, min]` about as often as it produces `[min, max]`.
  return left >= Math.min(min, max) && left <= Math.max(min, max)
}

function fold(value: string, caseSensitive: boolean): string {
  return caseSensitive ? value : value.toLowerCase()
}
