import { defineColumns } from '../src'

/**
 * One row shape and one column list, shared by every suite so the cases line up
 * across files -- the same reason `query-builder`'s tests share a schema.
 *
 * The data is deliberately awkward: a missing `total`, a `NaN`, an unparseable
 * date, a duplicate `owner`, mixed case, and enum values whose declared order
 * differs from their alphabetical one. Every one of those is a rule documented
 * somewhere in `internal/`.
 */
export interface Task {
  readonly id: number
  readonly title: string
  readonly owner: string | null
  readonly total: number | undefined
  readonly done: boolean
  readonly dueAt: string | Date | null
  readonly status: string
}

export const columns = defineColumns<Task>()([
  { id: 'title', kind: 'string' },
  { id: 'owner', kind: 'string' },
  { id: 'total', kind: 'number' },
  { id: 'done', kind: 'boolean' },
  { id: 'dueAt', kind: 'date' },
  { id: 'status', kind: 'enum', values: ['low', 'medium', 'high'] },
  { id: 'secret', kind: 'string', filterable: false, searchable: false, sortable: false },
])

export const tasks: readonly Task[] = [
  {
    id: 1,
    title: 'Write invoice',
    owner: 'Ada',
    total: 120,
    done: false,
    dueAt: '2024-03-01T00:00:00.000Z',
    status: 'high',
  },
  {
    id: 2,
    title: 'review INVOICE',
    owner: 'ada',
    total: 20,
    done: true,
    dueAt: new Date('2024-01-15T00:00:00.000Z'),
    status: 'low',
  },
  {
    id: 3,
    title: 'Archive',
    owner: null,
    total: undefined,
    done: false,
    dueAt: null,
    status: 'medium',
  },
  {
    id: 4,
    title: 'Ship',
    owner: 'Grace',
    total: Number.NaN,
    done: true,
    dueAt: 'not a date',
    status: 'unranked',
  },
]

export const ids = (rows: readonly Task[]): number[] => rows.map((row) => row.id)

/**
 * Run `fn` and hand back whatever it threw.
 *
 * `toBeEcosystemError` asserts on an error *value*, and `expect(fn).toThrow()`
 * gives no way to reach it, so every suite in the ecosystem needs this bridge.
 */
export function captureError(fn: () => unknown): unknown {
  try {
    fn()
    return undefined
  } catch (err) {
    return err
  }
}
