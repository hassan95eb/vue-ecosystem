/**
 * Sorting: the state transition a header click makes, and the comparators that
 * turn that state into an ordered array.
 *
 * ## Decisions worth knowing about
 *
 * - **Missing values (`null` / `undefined` / absent) sort last in both
 *   directions.** Not "first when ascending". A user flipping the direction
 *   wants the other end of the *data*, not a screenful of blanks. This is the
 *   one comparison the direction does not invert, which is why it is settled in
 *   {@link compareMissing} before {@link compareCells} is ever called -- by the
 *   time a value reaches a comparator it is guaranteed present.
 * - **Present-but-uncomparable values** (a `NaN`, an unparseable date, a string
 *   in a `number` column) sort *after* comparable ones, and that ordering does
 *   flip with the direction. They are data errors, not absences, and pretending
 *   otherwise would mean a second special case in every comparator.
 * - **The sort is stable**, because `Array.prototype.sort` has been required to
 *   be since ES2019. That is what makes multi-column sorting composable: the
 *   rules become one comparator chain, and equal rows keep the order the
 *   previous stage (filtering, which preserves source order) left them in.
 * - **Strings compare with `Intl.Collator`**, not `<`. `<` compares UTF-16 code
 *   units, which puts `Z` before `a` and orders Persian, Turkish and accented
 *   Latin text wrongly. The collator is built once per `sortRows` call, not per
 *   comparison -- constructing one is expensive enough to dominate the sort
 *   otherwise. Pass `locale` to pin it; leaving it undefined uses the host
 *   locale, which is right for an app and wrong for a snapshot test.
 * - **Enum columns sort by their declared `values` order**, not alphabetically.
 *   `low, medium, high` is the whole reason to declare them.
 */

import { columnKind, getCellValue, type AnyColumnDef, type ColumnDef } from './columns'

export type SortDirection = 'asc' | 'desc'

export interface SortRule {
  readonly columnId: string
  readonly direction: SortDirection
}

export interface SortOptions {
  /** BCP 47 tag for the string collator. Defaults to the host locale. */
  readonly locale?: string
}

/**
 * The next sort state after clicking a header.
 *
 * The cycle is `none -> asc -> desc -> none`. The third state matters: without
 * it there is no way back to the source order once a column has been touched,
 * and "the order the server sent" is frequently the meaningful one.
 *
 * With `multi: false` (the default) the clicked column replaces the whole list.
 * With `multi: true` it is appended, keeping the existing rules and their
 * priority -- array order *is* the priority.
 */
export function cycleSort(
  rules: readonly SortRule[],
  columnId: string,
  options: { readonly multi?: boolean } = {},
): readonly SortRule[] {
  const existing = rules.find((rule) => rule.columnId === columnId)
  const next: SortDirection | null =
    existing === undefined ? 'asc' : existing.direction === 'asc' ? 'desc' : null

  if (options.multi !== true) {
    return next === null ? [] : [{ columnId, direction: next }]
  }

  if (next === null) {
    return rules.filter((rule) => rule.columnId !== columnId)
  }
  if (existing === undefined) {
    return [...rules, { columnId, direction: next }]
  }
  return rules.map((rule) => (rule.columnId === columnId ? { columnId, direction: next } : rule))
}

/** Direction currently applied to a column, or `null`. */
export function directionFor(rules: readonly SortRule[], columnId: string): SortDirection | null {
  return rules.find((rule) => rule.columnId === columnId)?.direction ?? null
}

/**
 * 1-based priority of a column in a multi-column sort, `0` when unsorted.
 * Headers render it as the small "1" / "2" badge beside the arrow.
 */
export function priorityFor(rules: readonly SortRule[], columnId: string): number {
  return rules.findIndex((rule) => rule.columnId === columnId) + 1
}

/**
 * Sort a copy of `rows`. Never mutates its input.
 *
 * Rules naming an unknown column, or one with `sortable: false`, are skipped
 * rather than throwing: sort state routinely outlives a column list (a saved
 * view, a URL query string), and dropping a stale rule degrades better than a
 * blank page does.
 */
export function sortRows<T>(
  rows: readonly T[],
  rules: readonly SortRule[],
  columns: readonly ColumnDef<T>[],
  options: SortOptions = {},
): T[] {
  const applicable = rules.flatMap((rule) => {
    const column = columns.find((c) => c.id === rule.columnId)
    return column === undefined || column.sortable === false ? [] : [{ rule, column }]
  })

  if (applicable.length === 0) return [...rows]

  const collator = new Intl.Collator(options.locale, { numeric: true, sensitivity: 'variant' })

  return [...rows].sort((a, b) => {
    for (const { rule, column } of applicable) {
      const left = getCellValue(column, a)
      const right = getCellValue(column, b)

      // Absolute: deliberately NOT inverted for `desc`. See the module header.
      const missing = compareMissing(left, right)
      if (missing !== null) {
        if (missing !== 0) return missing
        continue
      }

      const result = compareCells(left, right, column, collator)
      if (result !== 0) return rule.direction === 'asc' ? result : -result
    }
    return 0
  })
}

/**
 * Settle a comparison in which at least one side is missing.
 *
 * Returns `null` when both sides are present, meaning "not my decision" -- the
 * `null` is what distinguishes it from a `0` that means "both missing, equal".
 */
export function compareMissing(a: unknown, b: unknown): number | null {
  const aMissing = a === null || a === undefined
  const bMissing = b === null || b === undefined
  if (!aMissing && !bMissing) return null
  if (aMissing && bMissing) return 0
  return aMissing ? 1 : -1
}

/**
 * Compare two *present* cell values for one column, ascending.
 *
 * Missing values never reach here -- {@link compareMissing} has already
 * answered for them. A column's own `compare` wins over the kind-based
 * comparator, and gets the same guarantee.
 */
export function compareCells(
  a: unknown,
  b: unknown,
  column: AnyColumnDef,
  collator: Intl.Collator,
): number {
  if (column.compare !== undefined) return column.compare(a, b)

  switch (columnKind(column)) {
    case 'number':
      return compareNumbers(a, b)
    case 'boolean':
      return typeof a === 'boolean' && typeof b === 'boolean' ? Number(a) - Number(b) : 0
    case 'date':
      return compareInstants(a, b)
    case 'enum':
      return compareEnum(a, b, column.values ?? [], collator)
    case 'string':
      return collator.compare(String(a), String(b))
  }
}

/** Non-numbers and `NaN` are uncomparable, and land after everything else. */
function compareNumbers(a: unknown, b: unknown): number {
  const left = typeof a === 'number' && !Number.isNaN(a) ? a : null
  const right = typeof b === 'number' && !Number.isNaN(b) ? b : null
  if (left === null || right === null) {
    return left === null && right === null ? 0 : left === null ? 1 : -1
  }
  return left - right
}

/**
 * Rows arrive from an ORM as `Date`, from `JSON.parse` as an ISO string and
 * from a fixture as an epoch number, so all three are accepted -- exactly the
 * three `query-builder`'s `evaluate()` accepts for a `date` field, kept
 * deliberately in step.
 */
function compareInstants(a: unknown, b: unknown): number {
  const left = toInstant(a)
  const right = toInstant(b)
  if (left === null || right === null) {
    return left === null && right === null ? 0 : left === null ? 1 : -1
  }
  return left - right
}

export function toInstant(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isNaN(ms) ? null : ms
  }
  if (typeof value !== 'string') return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

/** Declared order first; anything outside the list sorts after it, collated. */
function compareEnum(
  a: unknown,
  b: unknown,
  values: readonly string[],
  collator: Intl.Collator,
): number {
  const left = values.indexOf(String(a))
  const right = values.indexOf(String(b))
  if (left === -1 || right === -1) {
    if (left === -1 && right === -1) return collator.compare(String(a), String(b))
    return left === -1 ? 1 : -1
  }
  return left - right
}
