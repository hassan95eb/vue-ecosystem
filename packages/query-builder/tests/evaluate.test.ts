import { describe, expect, it } from 'vitest'
import { createQuery, evaluate, OPERATORS_BY_KIND, type QueryAst, type QueryRecord } from '../src'
import { looseWhere, schema, type TestSchema } from './fixtures'

/** Marks "the key is not present on the record at all", as distinct from `null`. */
const ABSENT = Symbol('absent')

interface Case {
  readonly field: keyof TestSchema & string
  readonly operator: string
  readonly operand?: unknown
  /** The record's value for the field, or {@link ABSENT}. */
  readonly value: unknown
  readonly expected: boolean
  readonly note?: string
}

function conditionAst(field: string, operator: string, operand: unknown): QueryAst {
  const builder = createQuery(schema)
  const where = looseWhere(builder)
  if (operand === undefined) where(field, operator)
  else where(field, operator, operand)
  return builder.build()
}

function run(testCase: Case, options?: { caseSensitive?: boolean }): boolean {
  const record: QueryRecord = testCase.value === ABSENT ? {} : { [testCase.field]: testCase.value }
  return evaluate(
    conditionAst(testCase.field, testCase.operator, testCase.operand),
    record,
    options,
  )
}

function label(testCase: Case): string {
  const operand = testCase.operand === undefined ? '' : ` ${JSON.stringify(testCase.operand)}`
  const value = testCase.value === ABSENT ? '<absent>' : JSON.stringify(testCase.value)
  const suffix = testCase.note === undefined ? '' : ` -- ${testCase.note}`
  return `${testCase.field} ${testCase.operator}${operand} vs ${value} -> ${testCase.expected}${suffix}`
}

// --- The operator x field-kind matrix -----------------------------------

const STRING_CASES: readonly Case[] = [
  { field: 'title', operator: 'eq', operand: 'invoice', value: 'invoice', expected: true },
  { field: 'title', operator: 'eq', operand: 'invoice', value: 'receipt', expected: false },
  {
    field: 'title',
    operator: 'eq',
    operand: 'INVOICE',
    value: 'invoice',
    expected: true,
    note: 'string equality folds case by default',
  },
  { field: 'title', operator: 'neq', operand: 'invoice', value: 'receipt', expected: true },
  { field: 'title', operator: 'neq', operand: 'invoice', value: 'invoice', expected: false },
  { field: 'title', operator: 'contains', operand: 'voi', value: 'invoice', expected: true },
  { field: 'title', operator: 'contains', operand: 'VOI', value: 'invoice', expected: true },
  { field: 'title', operator: 'contains', operand: 'zzz', value: 'invoice', expected: false },
  { field: 'title', operator: 'notContains', operand: 'zzz', value: 'invoice', expected: true },
  { field: 'title', operator: 'notContains', operand: 'voi', value: 'invoice', expected: false },
  { field: 'title', operator: 'startsWith', operand: 'inv', value: 'invoice', expected: true },
  { field: 'title', operator: 'startsWith', operand: 'ice', value: 'invoice', expected: false },
  { field: 'title', operator: 'endsWith', operand: 'ice', value: 'invoice', expected: true },
  { field: 'title', operator: 'endsWith', operand: 'inv', value: 'invoice', expected: false },
  { field: 'title', operator: 'in', operand: ['a', 'invoice'], value: 'invoice', expected: true },
  { field: 'title', operator: 'in', operand: ['a', 'b'], value: 'invoice', expected: false },
  { field: 'title', operator: 'notIn', operand: ['a', 'b'], value: 'invoice', expected: true },
  {
    field: 'title',
    operator: 'notIn',
    operand: ['a', 'invoice'],
    value: 'invoice',
    expected: false,
  },
  { field: 'title', operator: 'isNull', value: null, expected: true },
  { field: 'title', operator: 'isNull', value: 'invoice', expected: false },
  { field: 'title', operator: 'isNotNull', value: 'invoice', expected: true },
  { field: 'title', operator: 'isNotNull', value: null, expected: false },
  {
    field: 'title',
    operator: 'eq',
    operand: '',
    value: '',
    expected: true,
    note: 'the empty string is a value, not a missing value',
  },
  {
    field: 'title',
    operator: 'isNull',
    value: '',
    expected: false,
    note: 'the empty string is not null',
  },
  {
    field: 'title',
    operator: 'contains',
    operand: 'inv',
    value: 42,
    expected: false,
    note: 'record value of the wrong runtime type never matches',
  },
]

const NUMBER_CASES: readonly Case[] = [
  { field: 'priority', operator: 'eq', operand: 3, value: 3, expected: true },
  { field: 'priority', operator: 'eq', operand: 3, value: 4, expected: false },
  { field: 'priority', operator: 'neq', operand: 3, value: 4, expected: true },
  { field: 'priority', operator: 'neq', operand: 3, value: 3, expected: false },
  { field: 'priority', operator: 'gt', operand: 3, value: 4, expected: true },
  { field: 'priority', operator: 'gt', operand: 3, value: 3, expected: false },
  { field: 'priority', operator: 'gte', operand: 3, value: 3, expected: true },
  { field: 'priority', operator: 'gte', operand: 3, value: 2, expected: false },
  { field: 'priority', operator: 'lt', operand: 3, value: 2, expected: true },
  { field: 'priority', operator: 'lt', operand: 3, value: 3, expected: false },
  { field: 'priority', operator: 'lte', operand: 3, value: 3, expected: true },
  { field: 'priority', operator: 'lte', operand: 3, value: 4, expected: false },
  { field: 'priority', operator: 'between', operand: [2, 5], value: 3, expected: true },
  {
    field: 'priority',
    operator: 'between',
    operand: [2, 5],
    value: 2,
    expected: true,
    note: 'between is inclusive at the lower bound',
  },
  {
    field: 'priority',
    operator: 'between',
    operand: [2, 5],
    value: 5,
    expected: true,
    note: 'between is inclusive at the upper bound',
  },
  { field: 'priority', operator: 'between', operand: [2, 5], value: 6, expected: false },
  {
    field: 'priority',
    operator: 'between',
    operand: [5, 2],
    value: 3,
    expected: true,
    note: 'reversed bounds are normalised, not rejected',
  },
  { field: 'priority', operator: 'in', operand: [1, 3], value: 3, expected: true },
  { field: 'priority', operator: 'in', operand: [1, 2], value: 3, expected: false },
  { field: 'priority', operator: 'notIn', operand: [1, 2], value: 3, expected: true },
  { field: 'priority', operator: 'notIn', operand: [1, 3], value: 3, expected: false },
  { field: 'priority', operator: 'isNull', value: null, expected: true },
  { field: 'priority', operator: 'isNull', value: 0, expected: false },
  { field: 'priority', operator: 'isNotNull', value: 0, expected: true },
  { field: 'priority', operator: 'isNotNull', value: null, expected: false },
  {
    field: 'priority',
    operator: 'eq',
    operand: 0,
    value: 0,
    expected: true,
    note: 'zero is a value, not a missing value',
  },
  {
    field: 'priority',
    operator: 'gt',
    operand: 0,
    value: Number.NaN,
    expected: false,
    note: 'NaN is present but not a usable number',
  },
  { field: 'priority', operator: 'eq', operand: 3, value: '3', expected: false },
]

const BOOLEAN_CASES: readonly Case[] = [
  { field: 'active', operator: 'eq', operand: true, value: true, expected: true },
  { field: 'active', operator: 'eq', operand: true, value: false, expected: false },
  { field: 'active', operator: 'neq', operand: true, value: false, expected: true },
  { field: 'active', operator: 'neq', operand: true, value: true, expected: false },
  { field: 'active', operator: 'isNull', value: null, expected: true },
  {
    field: 'active',
    operator: 'isNull',
    value: false,
    expected: false,
    note: 'false is a value, not a missing value',
  },
  { field: 'active', operator: 'isNotNull', value: false, expected: true },
  { field: 'active', operator: 'isNotNull', value: null, expected: false },
  { field: 'active', operator: 'eq', operand: true, value: 1, expected: false },
]

const MIDDAY = '2024-06-15T12:00:00.000Z'
const MORNING = '2024-06-15T09:00:00.000Z'
const EVENING = '2024-06-15T20:00:00.000Z'

const DATE_CASES: readonly Case[] = [
  { field: 'createdAt', operator: 'eq', operand: MIDDAY, value: MIDDAY, expected: true },
  {
    field: 'createdAt',
    operator: 'eq',
    operand: '2024-06-15T12:00:00Z',
    value: MIDDAY,
    expected: true,
    note: 'compared as instants, not as strings',
  },
  {
    field: 'createdAt',
    operator: 'eq',
    operand: '2024-06-15',
    value: MIDDAY,
    expected: false,
    note: 'no truncation to a day -- use between for that',
  },
  { field: 'createdAt', operator: 'neq', operand: MIDDAY, value: MORNING, expected: true },
  { field: 'createdAt', operator: 'neq', operand: MIDDAY, value: MIDDAY, expected: false },
  { field: 'createdAt', operator: 'before', operand: MIDDAY, value: MORNING, expected: true },
  { field: 'createdAt', operator: 'before', operand: MIDDAY, value: MIDDAY, expected: false },
  { field: 'createdAt', operator: 'after', operand: MIDDAY, value: EVENING, expected: true },
  { field: 'createdAt', operator: 'after', operand: MIDDAY, value: MIDDAY, expected: false },
  { field: 'createdAt', operator: 'onOrBefore', operand: MIDDAY, value: MIDDAY, expected: true },
  { field: 'createdAt', operator: 'onOrBefore', operand: MIDDAY, value: EVENING, expected: false },
  { field: 'createdAt', operator: 'onOrAfter', operand: MIDDAY, value: MIDDAY, expected: true },
  { field: 'createdAt', operator: 'onOrAfter', operand: MIDDAY, value: MORNING, expected: false },
  {
    field: 'createdAt',
    operator: 'between',
    operand: ['2024-06-15T00:00:00.000Z', '2024-06-15T23:59:59.999Z'],
    value: MIDDAY,
    expected: true,
    note: 'day-granularity matching is a between over the day boundaries',
  },
  {
    field: 'createdAt',
    operator: 'between',
    operand: [MORNING, EVENING],
    value: '2024-06-16T00:00:00.000Z',
    expected: false,
  },
  {
    field: 'createdAt',
    operator: 'after',
    operand: MORNING,
    value: new Date(MIDDAY),
    expected: true,
    note: 'a Date instance on the record side is accepted',
  },
  {
    field: 'createdAt',
    operator: 'after',
    operand: MORNING,
    value: Date.parse(MIDDAY),
    expected: true,
    note: 'an epoch number on the record side is accepted',
  },
  {
    field: 'createdAt',
    operator: 'before',
    operand: MIDDAY,
    value: 'not a date',
    expected: false,
    note: 'present but unparseable is a non-match',
  },
  {
    field: 'createdAt',
    operator: 'isNull',
    value: 'not a date',
    expected: false,
    note: 'an unparseable date is present, so it is not null either',
  },
  { field: 'createdAt', operator: 'isNull', value: null, expected: true },
  { field: 'createdAt', operator: 'isNotNull', value: MIDDAY, expected: true },
  { field: 'createdAt', operator: 'isNotNull', value: null, expected: false },
]

const ENUM_CASES: readonly Case[] = [
  { field: 'status', operator: 'eq', operand: 'open', value: 'open', expected: true },
  { field: 'status', operator: 'eq', operand: 'open', value: 'closed', expected: false },
  {
    field: 'status',
    operator: 'eq',
    operand: 'open',
    value: 'Open',
    expected: false,
    note: 'enum members are identifiers, so case matters',
  },
  { field: 'status', operator: 'neq', operand: 'open', value: 'closed', expected: true },
  { field: 'status', operator: 'neq', operand: 'open', value: 'open', expected: false },
  {
    field: 'status',
    operator: 'in',
    operand: ['open', 'archived'],
    value: 'archived',
    expected: true,
  },
  { field: 'status', operator: 'in', operand: ['open'], value: 'closed', expected: false },
  { field: 'status', operator: 'notIn', operand: ['open'], value: 'closed', expected: true },
  { field: 'status', operator: 'notIn', operand: ['open'], value: 'open', expected: false },
  { field: 'status', operator: 'isNull', value: null, expected: true },
  { field: 'status', operator: 'isNull', value: 'open', expected: false },
  { field: 'status', operator: 'isNotNull', value: 'open', expected: true },
  { field: 'status', operator: 'isNotNull', value: null, expected: false },
]

const MATRIX = {
  string: STRING_CASES,
  number: NUMBER_CASES,
  boolean: BOOLEAN_CASES,
  date: DATE_CASES,
  enum: ENUM_CASES,
} as const

describe('evaluate: operator x field kind', () => {
  for (const [kind, cases] of Object.entries(MATRIX)) {
    describe(kind, () => {
      it('exercises every operator the kind declares', () => {
        const covered = new Set(cases.map((c) => c.operator))
        const declared = OPERATORS_BY_KIND[kind as keyof typeof MATRIX]

        // Guards the table against the table's real failure mode: an operator
        // gets added to OPERATORS_BY_KIND and nobody notices it is untested.
        expect([...declared].filter((op) => !covered.has(op))).toEqual([])
      })

      for (const testCase of cases) {
        it(label(testCase), () => {
          expect(run(testCase)).toBe(testCase.expected)
        })
      }
    })
  }
})

// --- Missing values -----------------------------------------------------

describe('evaluate: null, undefined and absent keys', () => {
  const MISSING = [
    ['null', null],
    ['undefined', undefined],
    ['an absent key', ABSENT],
  ] as const

  for (const [name, value] of MISSING) {
    it(`treats ${name} as missing: matches isNull and nothing else`, () => {
      expect(run({ field: 'title', operator: 'isNull', value, expected: true })).toBe(true)
      expect(run({ field: 'title', operator: 'isNotNull', value, expected: false })).toBe(false)
    })

    it(`returns false for negative operators against ${name}`, () => {
      // The deliberate choice: `neq`/`notContains`/`notIn` mean "present AND
      // different", not "not equal, including when absent". A three-valued
      // logic would be the alternative, and would make `evaluate` return
      // something other than a boolean.
      expect(run({ field: 'title', operator: 'neq', operand: 'x', value, expected: false })).toBe(
        false,
      )
      expect(
        run({ field: 'title', operator: 'notContains', operand: 'x', value, expected: false }),
      ).toBe(false)
      expect(
        run({ field: 'title', operator: 'notIn', operand: ['x'], value, expected: false }),
      ).toBe(false)
    })
  }

  it('needs an explicit or-group to mean "missing or different"', () => {
    const ast = createQuery(schema)
      .any((g) => g.where('title', 'isNull').where('title', 'neq', 'invoice'))
      .build()

    expect(evaluate(ast, {})).toBe(true)
    expect(evaluate(ast, { title: 'receipt' })).toBe(true)
    expect(evaluate(ast, { title: 'invoice' })).toBe(false)
  })
})

// --- Case sensitivity ---------------------------------------------------

describe('evaluate: case sensitivity', () => {
  it('folds case for string fields by default', () => {
    expect(
      run({
        field: 'title',
        operator: 'contains',
        operand: 'INV',
        value: 'invoice',
        expected: true,
      }),
    ).toBe(true)
  })

  it('respects case when caseSensitive is on', () => {
    const testCase: Case = {
      field: 'title',
      operator: 'contains',
      operand: 'INV',
      value: 'invoice',
      expected: false,
    }
    expect(run(testCase, { caseSensitive: true })).toBe(false)
  })

  it('never folds case for enum fields, even with the default options', () => {
    expect(
      run({ field: 'status', operator: 'eq', operand: 'open', value: 'Open', expected: false }),
    ).toBe(false)
  })
})

// --- Groups -------------------------------------------------------------

describe('evaluate: groups', () => {
  it('treats an empty and-group as matching everything', () => {
    expect(evaluate(createQuery(schema, { combinator: 'and' }).build(), { title: 'x' })).toBe(true)
  })

  it('treats an empty or-group as matching everything too', () => {
    // Not the algebraic identity for `or` (that would be false). An empty
    // filter is the initial state of every builder UI, and it must not hide
    // every row -- see the README.
    expect(evaluate(createQuery(schema, { combinator: 'or' }).build(), { title: 'x' })).toBe(true)
  })

  it('inverts an empty negated group', () => {
    const ast = createQuery(schema, { negate: true }).build()
    expect(evaluate(ast, { title: 'x' })).toBe(false)
  })

  it('requires every child of an and-group', () => {
    const ast = createQuery(schema)
      .where('title', 'contains', 'inv')
      .where('priority', 'gte', 3)
      .build()

    expect(evaluate(ast, { title: 'invoice', priority: 5 })).toBe(true)
    expect(evaluate(ast, { title: 'invoice', priority: 1 })).toBe(false)
    expect(evaluate(ast, { title: 'receipt', priority: 5 })).toBe(false)
  })

  it('requires one child of an or-group', () => {
    const ast = createQuery(schema, { combinator: 'or' })
      .where('status', 'eq', 'open')
      .where('priority', 'gte', 9)
      .build()

    expect(evaluate(ast, { status: 'open', priority: 1 })).toBe(true)
    expect(evaluate(ast, { status: 'closed', priority: 9 })).toBe(true)
    expect(evaluate(ast, { status: 'closed', priority: 1 })).toBe(false)
  })

  it('negates a group', () => {
    const ast = createQuery(schema)
      .group('or', (g) => g.where('status', 'eq', 'closed').where('status', 'eq', 'archived'), {
        negate: true,
      })
      .build()

    expect(evaluate(ast, { status: 'open' })).toBe(true)
    expect(evaluate(ast, { status: 'closed' })).toBe(false)
  })

  it('nests groups to arbitrary depth', () => {
    // title contains "q" AND (priority > 8 OR (active = true AND status = open))
    const ast = createQuery(schema)
      .where('title', 'contains', 'q')
      .any((outer) =>
        outer
          .where('priority', 'gt', 8)
          .all((inner) => inner.where('active', 'eq', true).where('status', 'eq', 'open')),
      )
      .build()

    expect(evaluate(ast, { title: 'q1', priority: 9, active: false, status: 'closed' })).toBe(true)
    expect(evaluate(ast, { title: 'q1', priority: 1, active: true, status: 'open' })).toBe(true)
    expect(evaluate(ast, { title: 'q1', priority: 1, active: true, status: 'closed' })).toBe(false)
    expect(evaluate(ast, { title: 'annual', priority: 9, active: true, status: 'open' })).toBe(
      false,
    )
  })

  it('double negation is the identity', () => {
    const inner = createQuery(schema, { negate: true }).where('status', 'eq', 'open').build()
    const outer: QueryAst = { type: 'group', combinator: 'and', negate: true, children: [inner] }

    expect(evaluate(outer, { status: 'open' })).toBe(true)
    expect(evaluate(outer, { status: 'closed' })).toBe(false)
  })
})

// --- Purity -------------------------------------------------------------

describe('evaluate: purity', () => {
  it('mutates neither the AST nor the record', () => {
    const ast = createQuery(schema).where('title', 'contains', 'inv').build()
    const record = { title: 'invoice', priority: 3 }
    const astBefore = JSON.stringify(ast)
    const recordBefore = JSON.stringify(record)

    evaluate(ast, record)

    expect(JSON.stringify(ast)).toBe(astBefore)
    expect(JSON.stringify(record)).toBe(recordBefore)
  })

  it('throws a QueryBuilderError for an operator no builder could produce', () => {
    const ast: QueryAst = {
      type: 'group',
      combinator: 'and',
      negate: false,
      children: [{ type: 'condition', field: 'title', kind: 'string', operator: 'eq', value: 'x' }],
    }
    const hand = JSON.parse(JSON.stringify(ast)) as { children: { operator: string }[] }
    hand.children[0]!.operator = 'matchesRegex'

    let thrown: unknown = '<did not throw>'
    try {
      evaluate(hand as unknown as QueryAst, { title: 'x' })
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeEcosystemError('query-builder/unsupported-operator')
  })
})
