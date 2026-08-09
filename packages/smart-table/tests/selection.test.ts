import { describe, expect, it } from 'vitest'
import {
  defaultRowId,
  isAllSelected,
  isIndeterminate,
  resolveRowId,
  setSelected,
  toggleAll,
  toggleSelection,
  type RowId,
} from '../src'
import { captureError } from './fixtures'

const set = (...ids: RowId[]): ReadonlySet<RowId> => new Set(ids)

describe('defaultRowId', () => {
  it('reads a string or number id', () => {
    expect(defaultRowId({ id: 7 })).toBe(7)
    expect(defaultRowId({ id: 'abc' })).toBe('abc')
  })

  it('rejects anything else, including a nested object id', () => {
    expect(defaultRowId({ id: { nested: true } })).toBeNull()
    expect(defaultRowId({})).toBeNull()
    expect(defaultRowId(null)).toBeNull()
    expect(defaultRowId('not a row')).toBeNull()
  })
})

describe('resolveRowId', () => {
  it('throws rather than falling back to the index', () => {
    expect(captureError(() => resolveRowId({}, 3, defaultRowId))).toBeEcosystemError(
      'smart-table/missing-row-id',
    )
  })

  it('rejects NaN, which would collapse every row onto one key', () => {
    expect(captureError(() => resolveRowId({}, 0, () => Number.NaN))).toBeEcosystemError(
      'smart-table/missing-row-id',
    )
  })

  it('accepts a custom resolver', () => {
    expect(resolveRowId({ uuid: 'x' }, 0, (row) => row.uuid)).toBe('x')
  })
})

describe('toggleSelection', () => {
  it('adds and removes in multiple mode', () => {
    expect([...toggleSelection(set(), 1, 'multiple')]).toEqual([1])
    expect([...toggleSelection(set(1, 2), 1, 'multiple')]).toEqual([2])
  })

  it('keeps at most one in single mode', () => {
    expect([...toggleSelection(set(1), 2, 'single')]).toEqual([2])
    expect([...toggleSelection(set(1), 1, 'single')]).toEqual([])
  })

  it('is a no-op in none mode', () => {
    expect([...toggleSelection(set(1), 2, 'none')]).toEqual([])
  })

  it('never mutates the input set', () => {
    const before = set(1)
    toggleSelection(before, 2, 'multiple')
    expect([...before]).toEqual([1])
  })
})

describe('setSelected', () => {
  it('forces a state instead of flipping it', () => {
    expect([...setSelected(set(1), 1, true, 'multiple')]).toEqual([1])
    expect([...setSelected(set(1), 1, false, 'multiple')]).toEqual([])
  })

  it('replaces the selection in single mode', () => {
    expect([...setSelected(set(1), 2, true, 'single')]).toEqual([2])
  })

  it('is a no-op in none mode', () => {
    expect([...setSelected(set(1), 2, true, 'none')]).toEqual([])
  })
})

describe('toggleAll', () => {
  it('selects every id when not all are selected', () => {
    expect([...toggleAll(set(1), [1, 2, 3], 'multiple')]).toEqual([1, 2, 3])
  })

  it('clears them once they all are', () => {
    expect([...toggleAll(set(1, 2, 3), [1, 2, 3], 'multiple')]).toEqual([])
  })

  it('leaves ids outside the current filter alone', () => {
    expect([...toggleAll(set(9), [1, 2], 'multiple')].sort()).toEqual([1, 2, 9])
    expect([...toggleAll(set(9, 1, 2), [1, 2], 'multiple')]).toEqual([9])
  })

  it('does nothing in single mode -- there is no "all" to select', () => {
    expect([...toggleAll(set(1), [1, 2], 'single')]).toEqual([1])
  })

  it('empties the selection in none mode', () => {
    expect([...toggleAll(set(1), [1, 2], 'none')]).toEqual([])
  })
})

describe('isAllSelected / isIndeterminate', () => {
  it('is false for an empty row set', () => {
    expect(isAllSelected(set(1), [])).toBe(false)
    expect(isIndeterminate(set(1), [])).toBe(false)
  })

  it('reports the mixed state', () => {
    expect(isIndeterminate(set(1), [1, 2])).toBe(true)
    expect(isIndeterminate(set(1, 2), [1, 2])).toBe(false)
    expect(isAllSelected(set(1, 2), [1, 2])).toBe(true)
  })
})
