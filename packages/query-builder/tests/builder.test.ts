import { describe, expect, it } from 'vitest'
import { createQuery, defineSchema, emptyQuery, isCondition, isGroup } from '../src'
import { looseWhere, schema } from './fixtures'

function captureError(fn: () => unknown): unknown {
  try {
    fn()
  } catch (err) {
    return err
  }
  return '<did not throw>'
}

describe('defineSchema', () => {
  it('preserves the schema unchanged', () => {
    const input = { title: { kind: 'string' } } as const
    expect(defineSchema(input)).toBe(input)
  })

  it('rejects an enum with no values', () => {
    expect(
      captureError(() => defineSchema({ s: { kind: 'enum', values: [] } })),
    ).toBeEcosystemError('query-builder/invalid-schema')
  })

  it('rejects non-string enum values', () => {
    const bad = { s: { kind: 'enum', values: [1, 2] } } as unknown as Parameters<
      typeof defineSchema
    >[0]
    expect(captureError(() => defineSchema(bad))).toBeEcosystemError('query-builder/invalid-schema')
  })
})

describe('createQuery', () => {
  it('starts as an empty and-group', () => {
    expect(createQuery(schema).build()).toStrictEqual(emptyQuery('and'))
  })

  it('records the field kind on each condition', () => {
    const ast = createQuery(schema).where('priority', 'gte', 3).build()

    expect(ast.children[0]).toStrictEqual({
      type: 'condition',
      field: 'priority',
      kind: 'number',
      operator: 'gte',
      value: 3,
    })
  })

  it('nests groups with all() and any()', () => {
    const ast = createQuery(schema)
      .where('title', 'eq', 'a')
      .any((g) => g.where('priority', 'gt', 1))
      .all((g) => g.where('active', 'eq', true))
      .build()

    expect(ast.children).toHaveLength(3)
    expect(isCondition(ast.children[0]!)).toBe(true)
    expect(isGroup(ast.children[1]!)).toBe(true)
    expect((ast.children[1] as { combinator: string }).combinator).toBe('or')
    expect((ast.children[2] as { combinator: string }).combinator).toBe('and')
  })

  it('negates the group it is called on', () => {
    expect(createQuery(schema).negate().build().negate).toBe(true)
    expect(createQuery(schema).negate(false).build().negate).toBe(false)
    expect(createQuery(schema, { negate: true }).build().negate).toBe(true)
  })

  it('copies the operand array, so a later mutation of the caller’s array is not shared', () => {
    const values = [1, 2]
    const ast = createQuery(schema).where('priority', 'in', values).build()

    values.push(3)

    expect((ast.children[0] as unknown as { value: number[] }).value).toStrictEqual([1, 2])
  })

  // --- Runtime backstops for JavaScript callers -------------------------

  it('rejects an unknown field, naming the fields it knows', () => {
    const err = captureError(() => looseWhere(createQuery(schema))('nope', 'eq', 'x'))

    expect(err).toBeEcosystemError('query-builder/unknown-field')
    expect((err as Error).message).toContain('title')
  })

  it('rejects an operator that is illegal for the field kind', () => {
    const err = captureError(() => looseWhere(createQuery(schema))('priority', 'contains', 'x'))

    expect(err).toBeEcosystemError('query-builder/unknown-operator')
    expect((err as Error).message).toContain('number field')
  })

  it('rejects an operand of the wrong type', () => {
    expect(
      captureError(() => looseWhere(createQuery(schema))('priority', 'eq', 'three')),
    ).toBeEcosystemError('query-builder/invalid-value')
  })

  it('rejects an enum value that is not a declared member', () => {
    expect(
      captureError(() => looseWhere(createQuery(schema))('status', 'eq', 'pending')),
    ).toBeEcosystemError('query-builder/invalid-value')
  })

  it('rejects an unparseable date in the query', () => {
    expect(
      captureError(() => looseWhere(createQuery(schema))('createdAt', 'before', 'yesterday')),
    ).toBeEcosystemError('query-builder/invalid-value')
  })

  it('rejects an empty in() list', () => {
    expect(
      captureError(() => looseWhere(createQuery(schema))('priority', 'in', [])),
    ).toBeEcosystemError('query-builder/invalid-value')
  })

  it('reports the path the bad node would have occupied', () => {
    const err = captureError(() =>
      createQuery(schema)
        .where('title', 'eq', 'a')
        .all((g) => looseWhere(g)('priority', 'eq', 'three')),
    )

    expect((err as Error).message).toContain('root.children[1].children[0]')
  })
})

// --- Type-level rules ---------------------------------------------------
//
// These have no runtime assertions on purpose: `@ts-expect-error` *is* the
// assertion, and `pnpm typecheck` fails if any of them ever starts compiling.
// That is the difference between "a number field rejects contains" being a
// documented convention and being a property of the API.

describe('type-level operator rules', () => {
  it('rejects illegal (kind, operator) pairs at compile time', () => {
    // Declared, deliberately never called: every line below would also throw at
    // runtime, and that is the weaker guarantee. `@ts-expect-error` is the
    // assertion, and `pnpm typecheck` is what runs it.
    const illegal = (): void => {
      const q = createQuery(schema)

      // @ts-expect-error `contains` is a string operator; `priority` is a number
      q.where('priority', 'contains', 'x')

      // @ts-expect-error `gt` is not legal for a string field
      q.where('title', 'gt', 'x')

      // @ts-expect-error `between` is not legal for a boolean field
      q.where('active', 'between', [true, false])

      // @ts-expect-error `before` is a date operator
      q.where('priority', 'before', '2024-01-01T00:00:00.000Z')

      // @ts-expect-error no such field
      q.where('nope', 'eq', 'x')
    }

    expect(illegal).toBeTypeOf('function')
  })

  it('rejects operands of the wrong type at compile time', () => {
    const illegal = (): void => {
      const q = createQuery(schema)

      // @ts-expect-error a number field takes a number
      q.where('priority', 'eq', '3')

      // @ts-expect-error `in` takes an array
      q.where('priority', 'in', 3)

      // @ts-expect-error `between` takes a pair
      q.where('priority', 'between', [1, 2, 3])

      // @ts-expect-error unary operators take no operand at all
      q.where('title', 'isNull', 'x')

      // @ts-expect-error 'pending' is not a declared member of the enum
      q.where('status', 'eq', 'pending')
    }

    expect(illegal).toBeTypeOf('function')
  })

  it('accepts the legal pairings', () => {
    const ast = createQuery(schema)
      .where('title', 'contains', 'a')
      .where('priority', 'between', [1, 5])
      .where('active', 'eq', true)
      .where('createdAt', 'onOrAfter', '2024-01-01T00:00:00.000Z')
      .where('status', 'in', ['open', 'closed'])
      .where('status', 'isNotNull')
      .build()

    expect(ast.children).toHaveLength(6)
  })
})
