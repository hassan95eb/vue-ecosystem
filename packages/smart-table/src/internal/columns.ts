/**
 * Column definitions, and the bridge from a column list to a `query-builder`
 * schema.
 *
 * No Vue import lives in this file, or anywhere else under `internal/` -- the
 * composable in `../composables/useSmartTable.ts` is the only reactive glue.
 * Everything decidable from a column list and a plain array is decided here,
 * so it is testable without mounting anything. Same split as `virtual-scroll`
 * and `query-builder`; see CONTRIBUTING.md, "Framework-agnostic core".
 *
 * ## Why a column carries a `kind`
 *
 * A column is not only "what to render in this cell". It is also the field a
 * filter condition names and the value a sort comparator orders. Both of those
 * need to know whether the cell holds a number, a date or an identifier --
 * `'10'` sorts before `'9'` as a string and after it as a number, and
 * `contains` is meaningless on a boolean. Declaring the kind once, on the
 * column, is what lets `deriveSchema()` hand `query-builder` a schema that is
 * *already* correct rather than asking the consumer to write it twice and keep
 * the two in sync.
 */

import type { FieldDef, FieldKind, Schema } from '@vue-ecosystem/query-builder'
import { duplicateColumnId, invalidColumnId, invalidEnumColumn } from './errors'

/** Kinds a column may declare. Mirrors `query-builder`'s {@link FieldKind} exactly. */
export type ColumnKind = FieldKind

interface ColumnDefBase<T> {
  /**
   * Stable identifier. Doubles as the filter field name, the sort key and the
   * default property to read from a row, so it is not a display concern --
   * `header` is.
   */
  readonly id: string
  /** Display label. Defaults to `id` at render time; this package never renders it. */
  readonly header?: string
  /**
   * How to read this column's value out of a row. Defaults to `row[id]`.
   *
   * Return the *comparable* value, not the formatted one: `1_700_000_000_000`,
   * not `'18 Nov 2023'`. Formatting is the renderer's job and a formatted value
   * sorts and filters wrongly.
   */
  readonly accessor?: (row: T) => unknown
  /** Defaults to `true`. */
  readonly sortable?: boolean
  /**
   * Defaults to `true`. A column with `filterable: false` is left out of
   * {@link deriveSchema}'s result -- at runtime *and* in its type -- so naming
   * it in a filter is a compile error rather than a runtime validation failure.
   */
  readonly filterable?: boolean
  /** Include this column in the global text search. Defaults to `true`. */
  readonly searchable?: boolean
  /**
   * Override the comparator for this column only.
   *
   * Receives the accessor's output for two rows and returns the usual negative
   * / zero / positive. Ascending order; the sort applies the direction. Missing
   * values never reach it -- see `sort.ts`.
   */
  readonly compare?: (a: unknown, b: unknown) => number
}

/**
 * A column definition.
 *
 * `kind` defaults to `'string'`. The `enum` arm additionally requires `values`,
 * because for an enum that array is *both* the legal filter operands and the
 * sort order -- an enum column without it has no defined ordering.
 */
export type ColumnDef<T> = ColumnDefBase<T> &
  (
    | { readonly kind?: Exclude<ColumnKind, 'enum'>; readonly values?: undefined }
    | { readonly kind: 'enum'; readonly values: readonly string[] }
  )

/**
 * The supertype of every `ColumnDef<T>`.
 *
 * `accessor` sits in a property position, so it is contravariant in `T` under
 * `strictFunctionTypes`; `never` as the row type therefore accepts a column
 * list for any row. This is what lets the type-level helpers below take a
 * column tuple without threading the row type through them.
 */
export type AnyColumnDef = ColumnDef<never>

/**
 * Define columns, preserving literal `id`s and enum `values`.
 *
 * The extra `()` is not decoration. TypeScript has no partial type-argument
 * inference: the moment you write `defineColumns<Row>([...])` the tuple type
 * `C` stops being inferred and every `id` widens to `string`, which costs you
 * the field-name autocomplete in the filter builder. Currying lets `Row` be
 * explicit and `C` inferred. It is the same trade `createColumnHelper` makes.
 *
 * ```ts
 * const columns = defineColumns<Invoice>()([
 *   { id: 'number', kind: 'string' },
 *   { id: 'total', kind: 'number' },
 *   { id: 'status', kind: 'enum', values: ['draft', 'sent', 'paid'] },
 *   { id: 'issuedAt', kind: 'date', accessor: (row) => row.issued_at },
 * ])
 * ```
 *
 * @throws {@link SmartTableError} `smart-table/invalid-column-id`,
 * `smart-table/duplicate-column-id` or `smart-table/invalid-enum-column`.
 * Synchronously, at definition time -- not on first render.
 */
export function defineColumns<T>(): <const C extends readonly ColumnDef<T>[]>(columns: C) => C {
  return (columns) => {
    assertValidColumns(columns)
    return columns
  }
}

/** Runtime validation, split out so the composable can re-check a plain array. */
export function assertValidColumns(columns: readonly AnyColumnDef[]): void {
  const seen = new Set<string>()

  for (const column of columns) {
    if (typeof column.id !== 'string' || column.id.length === 0) {
      throw invalidColumnId(column.id)
    }
    if (seen.has(column.id)) {
      throw duplicateColumnId(column.id)
    }
    seen.add(column.id)

    if (column.kind === 'enum' && (!Array.isArray(column.values) || column.values.length === 0)) {
      throw invalidEnumColumn(column.id)
    }
  }
}

/** `kind` with its default applied. */
export function columnKind(column: AnyColumnDef): ColumnKind {
  return column.kind ?? 'string'
}

/**
 * Read one cell.
 *
 * The default accessor is a plain property read by `id`. The cast is the one
 * unavoidable widening in the package: `T` is opaque here, and the alternative
 * -- constraining `T extends Record<string, unknown>` -- would reject rows
 * typed as interfaces, which is most of them.
 */
export function getCellValue<T>(column: ColumnDef<T>, row: T): unknown {
  return column.accessor === undefined
    ? (row as Record<string, unknown>)[column.id]
    : column.accessor(row)
}

// --- Schema derivation --------------------------------------------------

/** The `FieldDef` a single column maps to, with the enum `values` preserved. */
type FieldDefFor<D> = D extends { readonly kind: 'enum'; readonly values: infer V }
  ? V extends readonly string[]
    ? { readonly kind: 'enum'; readonly values: V }
    : never
  : D extends { readonly kind: infer K }
    ? K extends Exclude<ColumnKind, 'enum'>
      ? { readonly kind: K }
      : never
    : { readonly kind: 'string' }

/**
 * The `query-builder` schema a column tuple produces.
 *
 * Key remapping drops `filterable: false` columns, so the type and the runtime
 * object below agree by construction rather than by review.
 */
export type SchemaFor<C extends readonly AnyColumnDef[]> = {
  readonly [
    D in C[number] as D extends { readonly filterable: false } ? never : D['id']
  ]: FieldDefFor<D>
}

/**
 * Turn columns into the schema `useQueryBuilder` wants.
 *
 * ```ts
 * const schema = deriveSchema(columns)
 * const filter = useQueryBuilder(schema)
 * filter.addCondition([], 'status', 'in', ['sent', 'paid']) // both names autocomplete
 * ```
 *
 * The result is passed straight to `query-builder`, which validates it again on
 * the way in -- this function is a translation, not a second validator.
 */
export function deriveSchema<const C extends readonly AnyColumnDef[]>(columns: C): SchemaFor<C> {
  const schema: Record<string, FieldDef> = {}

  for (const column of columns) {
    if (column.filterable === false) continue

    schema[column.id] =
      column.kind === 'enum'
        ? { kind: 'enum', values: column.values, label: column.header }
        : { kind: columnKind(column) as Exclude<ColumnKind, 'enum'>, label: column.header }
  }

  // `SchemaFor<C>` is proved by the key-remapping above, not by this cast: the
  // loop skips exactly the columns the mapped type drops, and assigns exactly
  // the `FieldDef` shape `FieldDefFor` describes.
  return schema as Schema as SchemaFor<C>
}
