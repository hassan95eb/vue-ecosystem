import { EcosystemError } from '@vue-ecosystem/core'

export class SmartTableError extends EcosystemError {}

export function duplicateColumnId(id: string): SmartTableError {
  return new SmartTableError(
    `Duplicate column id '${id}'. Column ids address rows, sort rules and filter fields, so they must be unique.`,
    { code: 'smart-table/duplicate-column-id', details: { id } },
  )
}

export function invalidColumnId(id: unknown): SmartTableError {
  return new SmartTableError(
    `A column id must be a non-empty string, received ${JSON.stringify(id)}.`,
    { code: 'smart-table/invalid-column-id', details: { id } },
  )
}

export function invalidEnumColumn(id: string): SmartTableError {
  return new SmartTableError(
    `Enum column '${id}' needs a non-empty \`values\` array: it is both the filter operand list and the sort order.`,
    { code: 'smart-table/invalid-enum-column', details: { id } },
  )
}

export function invalidPageSize(pageSize: number): SmartTableError {
  return new SmartTableError(`pageSize must be an integer greater than 0, received ${pageSize}.`, {
    code: 'smart-table/invalid-page-size',
    details: { pageSize },
  })
}

/**
 * Thrown eagerly, on the first pass over the rows, rather than lazily when a
 * checkbox is clicked. A row without a stable id is a correctness problem for
 * selection *and* for `:key`, and it must not wait for a user interaction to
 * become visible.
 */
export function missingRowId(index: number): SmartTableError {
  return new SmartTableError(
    `Row at index ${index} has no usable id. Give rows an \`id\` property, or pass the \`rowId\` option. ` +
      `Falling back to the array index would silently break selection the moment rows are sorted or filtered.`,
    { code: 'smart-table/missing-row-id', details: { index } },
  )
}
