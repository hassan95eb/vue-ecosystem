import { describe, expect, it } from 'vitest'
import { compareMissing, cycleSort, directionFor, priorityFor, sortRows } from '../src'
import { columns, ids, tasks, type Task } from './fixtures'

// Pinned so the collator does not vary with the machine's locale.
const options = { locale: 'en' } as const

describe('cycleSort', () => {
  it('cycles none -> asc -> desc -> none', () => {
    const none = cycleSort([], 'title')
    expect(none).toEqual([{ columnId: 'title', direction: 'asc' }])

    const desc = cycleSort(none, 'title')
    expect(desc).toEqual([{ columnId: 'title', direction: 'desc' }])

    expect(cycleSort(desc, 'title')).toEqual([])
  })

  it('replaces the whole list in single-column mode', () => {
    const first = cycleSort([], 'title')
    expect(cycleSort(first, 'total')).toEqual([{ columnId: 'total', direction: 'asc' }])
  })

  it('appends in multi mode, preserving priority', () => {
    const first = cycleSort([], 'title', { multi: true })
    const second = cycleSort(first, 'total', { multi: true })

    expect(second).toEqual([
      { columnId: 'title', direction: 'asc' },
      { columnId: 'total', direction: 'asc' },
    ])
  })

  it('flips in place in multi mode rather than reordering', () => {
    const rules = [
      { columnId: 'title', direction: 'asc' },
      { columnId: 'total', direction: 'asc' },
    ] as const
    expect(cycleSort(rules, 'title', { multi: true })).toEqual([
      { columnId: 'title', direction: 'desc' },
      { columnId: 'total', direction: 'asc' },
    ])
  })

  it('removes only the cycled-out column in multi mode', () => {
    const rules = [
      { columnId: 'title', direction: 'desc' },
      { columnId: 'total', direction: 'asc' },
    ] as const
    expect(cycleSort(rules, 'title', { multi: true })).toEqual([
      { columnId: 'total', direction: 'asc' },
    ])
  })
})

describe('directionFor / priorityFor', () => {
  const rules = [
    { columnId: 'title', direction: 'asc' },
    { columnId: 'total', direction: 'desc' },
  ] as const

  it('reports the direction', () => {
    expect(directionFor(rules, 'total')).toBe('desc')
    expect(directionFor(rules, 'done')).toBeNull()
  })

  it('reports a 1-based priority, 0 when unsorted', () => {
    expect(priorityFor(rules, 'title')).toBe(1)
    expect(priorityFor(rules, 'total')).toBe(2)
    expect(priorityFor(rules, 'done')).toBe(0)
  })
})

describe('compareMissing', () => {
  it('returns null when both sides are present', () => {
    expect(compareMissing(1, 2)).toBeNull()
    expect(compareMissing('', 0)).toBeNull()
  })

  it('treats null and undefined as the same absence', () => {
    expect(compareMissing(null, undefined)).toBe(0)
    expect(compareMissing(null, 1)).toBe(1)
    expect(compareMissing(1, undefined)).toBe(-1)
  })
})

describe('sortRows', () => {
  it('does not mutate its input', () => {
    const input = [...tasks]
    sortRows(input, [{ columnId: 'title', direction: 'asc' }], columns, options)
    expect(ids(input)).toEqual([1, 2, 3, 4])
  })

  it('returns a copy when no rule applies', () => {
    const result = sortRows(tasks, [], columns, options)
    expect(result).not.toBe(tasks)
    expect(ids(result)).toEqual([1, 2, 3, 4])
  })

  it('collates strings rather than comparing code units', () => {
    const rows: Task[] = [
      { ...tasks[0]!, id: 10, title: 'apple' },
      { ...tasks[0]!, id: 11, title: 'Banana' },
      { ...tasks[0]!, id: 12, title: 'Cherry' },
    ]
    // A code-unit sort would put 'Banana' and 'Cherry' before 'apple'.
    expect(
      ids(sortRows(rows, [{ columnId: 'title', direction: 'asc' }], columns, options)),
    ).toEqual([10, 11, 12])
  })

  it('keeps missing values last in both directions', () => {
    const asc = sortRows(tasks, [{ columnId: 'owner', direction: 'asc' }], columns, options)
    const desc = sortRows(tasks, [{ columnId: 'owner', direction: 'desc' }], columns, options)

    expect(asc[asc.length - 1]!.id).toBe(3)
    expect(desc[desc.length - 1]!.id).toBe(3)
  })

  it('orders numbers numerically and pushes NaN after real numbers', () => {
    const result = sortRows(tasks, [{ columnId: 'total', direction: 'asc' }], columns, options)
    // 20, 120, then NaN (present but uncomparable), then the missing total.
    expect(ids(result)).toEqual([2, 1, 4, 3])
  })

  it('orders dates as instants across Date, ISO string and garbage', () => {
    const result = sortRows(tasks, [{ columnId: 'dueAt', direction: 'asc' }], columns, options)
    expect(ids(result)).toEqual([2, 1, 4, 3])
  })

  it('orders enums by declared values, unknown members last', () => {
    const result = sortRows(tasks, [{ columnId: 'status', direction: 'asc' }], columns, options)
    expect(ids(result)).toEqual([2, 3, 1, 4])
  })

  it('orders booleans false before true', () => {
    const result = sortRows(tasks, [{ columnId: 'done', direction: 'asc' }], columns, options)
    expect(ids(result)).toEqual([1, 3, 2, 4])
  })

  it('is stable: equal rows keep their source order', () => {
    const rows: Task[] = [
      { ...tasks[0]!, id: 20, title: 'same' },
      { ...tasks[0]!, id: 21, title: 'same' },
      { ...tasks[0]!, id: 22, title: 'same' },
    ]
    expect(
      ids(sortRows(rows, [{ columnId: 'title', direction: 'asc' }], columns, options)),
    ).toEqual([20, 21, 22])
  })

  it('falls through to the next rule when both values are missing', () => {
    const rows: Task[] = [
      { ...tasks[2]!, id: 40, owner: null, total: 2 },
      { ...tasks[2]!, id: 41, owner: null, total: 1 },
    ]
    const result = sortRows(
      rows,
      [
        { columnId: 'owner', direction: 'asc' },
        { columnId: 'total', direction: 'asc' },
      ],
      columns,
      options,
    )
    expect(ids(result)).toEqual([41, 40])
  })

  it('applies rules in priority order', () => {
    const rows: Task[] = [
      { ...tasks[0]!, id: 30, done: true, total: 2 },
      { ...tasks[0]!, id: 31, done: false, total: 3 },
      { ...tasks[0]!, id: 32, done: true, total: 1 },
    ]
    const result = sortRows(
      rows,
      [
        { columnId: 'done', direction: 'asc' },
        { columnId: 'total', direction: 'asc' },
      ],
      columns,
      options,
    )
    expect(ids(result)).toEqual([31, 32, 30])
  })

  it('skips a rule naming an unknown column instead of throwing', () => {
    expect(
      ids(sortRows(tasks, [{ columnId: 'gone', direction: 'asc' }], columns, options)),
    ).toEqual([1, 2, 3, 4])
  })

  it('skips a rule on a column with sortable: false', () => {
    expect(
      ids(sortRows(tasks, [{ columnId: 'secret', direction: 'asc' }], columns, options)),
    ).toEqual([1, 2, 3, 4])
  })

  it("prefers a column's own comparator", () => {
    const byLength = [
      { id: 'title', compare: (a: unknown, b: unknown) => String(a).length - String(b).length },
    ]
    const result = sortRows(tasks, [{ columnId: 'title', direction: 'asc' }], byLength, options)
    expect(ids(result)).toEqual([4, 3, 1, 2])
  })
})
