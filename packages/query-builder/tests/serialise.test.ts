import { describe, expect, it } from 'vitest'
import { formatPath, parse, serialise, validate, type QueryAst } from '../src'
import { schema } from './fixtures'

function captureError(fn: () => unknown): unknown {
  try {
    fn()
  } catch (err) {
    return err
  }
  return '<did not throw>'
}

const condition = {
  type: 'condition',
  field: 'priority',
  kind: 'number',
  operator: 'gte',
  value: 3,
}

function group(...children: unknown[]): unknown {
  return { type: 'group', combinator: 'and', negate: false, children }
}

/** A copy with the `value` key genuinely absent, not set to undefined. */
function withoutValue(node: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...node }
  delete copy['value']
  return copy
}

describe('serialise', () => {
  it('is JSON.stringify', () => {
    const ast = group(condition) as QueryAst
    expect(serialise(ast)).toBe(JSON.stringify(ast))
  })
})

describe('parse: structure', () => {
  it('returns the same object it validated', () => {
    const ast = group(condition)
    expect(parse(ast, schema)).toBe(ast)
  })

  it('rejects malformed JSON', () => {
    const err = captureError(() => parse('{ not json', schema))
    expect(err).toBeEcosystemError('query-builder/malformed-json')
  })

  it('rejects a non-object root', () => {
    expect(captureError(() => parse(42, schema))).toBeEcosystemError('query-builder/malformed-node')
    expect(captureError(() => parse(null, schema))).toBeEcosystemError(
      'query-builder/malformed-node',
    )
    expect(captureError(() => parse([], schema))).toBeEcosystemError('query-builder/malformed-node')
  })

  it('rejects a bare condition at the root', () => {
    const err = captureError(() => parse(condition, schema))

    expect(err).toBeEcosystemError('query-builder/malformed-node')
    expect((err as Error).message).toContain('root of a query must be a group')
  })

  it('rejects an unknown node type', () => {
    expect(captureError(() => parse({ type: 'wat' }, schema))).toBeEcosystemError(
      'query-builder/malformed-node',
    )
  })

  it('rejects a bad combinator', () => {
    const err = captureError(() =>
      parse({ type: 'group', combinator: 'xor', negate: false, children: [] }, schema),
    )

    expect(err).toBeEcosystemError('query-builder/malformed-node')
    expect((err as Error).message).toContain("'and' or 'or'")
  })

  it('requires negate to be present and boolean', () => {
    const err = captureError(() =>
      parse({ type: 'group', combinator: 'and', children: [] }, schema),
    )

    expect(err).toBeEcosystemError('query-builder/malformed-node')
    expect((err as Error).message).toContain('`negate`')
  })

  it('requires children to be an array', () => {
    expect(
      captureError(() =>
        parse({ type: 'group', combinator: 'and', negate: false, children: {} }, schema),
      ),
    ).toBeEcosystemError('query-builder/malformed-node')
  })
})

describe('parse: fields, operators and values', () => {
  it('rejects an unknown field and lists the known ones', () => {
    const err = captureError(() => parse(group({ ...condition, field: 'nope' }), schema))

    expect(err).toBeEcosystemError('query-builder/unknown-field')
    expect((err as Error).message).toContain('createdAt')
  })

  it('rejects a non-string field', () => {
    const err = captureError(() => parse(group({ ...condition, field: 7 }), schema))

    expect(err).toBeEcosystemError('query-builder/malformed-node')
    expect((err as Error).message).toContain('`field` must be a string')
  })

  it('rejects a non-string operator', () => {
    const err = captureError(() => parse(group({ ...condition, operator: null }), schema))

    expect(err).toBeEcosystemError('query-builder/malformed-node')
    expect((err as Error).message).toContain('`operator` must be a string')
  })

  it('rejects a kind that disagrees with the schema', () => {
    const err = captureError(() => parse(group({ ...condition, kind: 'string' }), schema))

    expect(err).toBeEcosystemError('query-builder/malformed-node')
    expect((err as Error).message).toContain("declared as 'number'")
  })

  it('rejects an operator that is illegal for the kind, listing the legal ones', () => {
    const err = captureError(() =>
      parse(group({ ...condition, operator: 'contains', value: 'x' }), schema),
    )

    expect(err).toBeEcosystemError('query-builder/unknown-operator')
    expect((err as Error).message).toContain('Legal operators: eq, neq, gt')
  })

  it('rejects a value of the wrong type', () => {
    const err = captureError(() => parse(group({ ...condition, value: 'three' }), schema))

    expect(err).toBeEcosystemError('query-builder/invalid-value')
    expect((err as Error).message).toContain('a finite number')
  })

  it('names the expected type for every field kind', () => {
    const cases = [
      [{ field: 'title', kind: 'string', operator: 'eq', value: 42 }, 'a string'],
      [{ field: 'active', kind: 'boolean', operator: 'eq', value: 'yes' }, 'a boolean'],
      [{ field: 'createdAt', kind: 'date', operator: 'eq', value: 7 }, 'an ISO 8601 date string'],
      [{ field: 'priority', kind: 'number', operator: 'eq', value: null }, 'a finite number'],
    ] as const

    for (const [node, expected] of cases) {
      const err = captureError(() => parse(group({ type: 'condition', ...node }), schema))
      expect(err).toBeEcosystemError('query-builder/invalid-value')
      expect((err as Error).message).toContain(expected)
    }
  })

  it('rejects a non-finite number', () => {
    // `Infinity` and `NaN` serialise to `null`, so accepting them would produce
    // a query that silently changes meaning on its first round trip.
    expect(
      captureError(() => parse(group({ ...condition, value: Number.POSITIVE_INFINITY }), schema)),
    ).toBeEcosystemError('query-builder/invalid-value')
  })

  it('rejects a missing value', () => {
    expect(captureError(() => parse(group(withoutValue(condition)), schema))).toBeEcosystemError(
      'query-builder/invalid-value',
    )
  })

  it('rejects a value key on a unary operator', () => {
    // Not pedantry: `JSON.stringify` deletes `undefined` properties, so a node
    // carrying `value: undefined` would not survive its own round trip.
    const err = captureError(() =>
      parse(group({ ...condition, operator: 'isNull', value: undefined }), schema),
    )

    expect(err).toBeEcosystemError('query-builder/malformed-node')
    expect((err as Error).message).toContain('must be absent')
  })

  it('accepts a unary operator with no value key', () => {
    const unary = withoutValue({ ...condition, operator: 'isNull' })
    expect(() => parse(group(unary), schema)).not.toThrow()
  })

  it('rejects a non-array operand for in / notIn', () => {
    expect(
      captureError(() => parse(group({ ...condition, operator: 'in', value: 3 }), schema)),
    ).toBeEcosystemError('query-builder/invalid-value')
  })

  it('rejects a single bad entry inside an otherwise valid in list', () => {
    const err = captureError(() =>
      parse(group({ ...condition, operator: 'in', value: [1, 'two', 3] }), schema),
    )

    expect(err).toBeEcosystemError('query-builder/invalid-value')
    expect((err as Error).message).toContain('an array of a finite number')
  })

  it('rejects a bad entry inside a between pair', () => {
    const err = captureError(() =>
      parse(group({ ...condition, operator: 'between', value: [1, null] }), schema),
    )

    expect(err).toBeEcosystemError('query-builder/invalid-value')
    expect((err as Error).message).toContain('[min, max] pair of a finite number')
  })

  it('rejects an empty in list', () => {
    expect(
      captureError(() => parse(group({ ...condition, operator: 'in', value: [] }), schema)),
    ).toBeEcosystemError('query-builder/invalid-value')
  })

  it('rejects a between operand that is not a pair', () => {
    expect(
      captureError(() =>
        parse(group({ ...condition, operator: 'between', value: [1, 2, 3] }), schema),
      ),
    ).toBeEcosystemError('query-builder/invalid-value')
  })

  it('rejects an unparseable date', () => {
    expect(
      captureError(() =>
        parse(
          group({
            type: 'condition',
            field: 'createdAt',
            kind: 'date',
            operator: 'before',
            value: 'yesterday',
          }),
          schema,
        ),
      ),
    ).toBeEcosystemError('query-builder/invalid-value')
  })

  it('rejects an enum value outside the declared members, listing them', () => {
    const err = captureError(() =>
      parse(
        group({
          type: 'condition',
          field: 'status',
          kind: 'enum',
          operator: 'eq',
          value: 'pending',
        }),
        schema,
      ),
    )

    expect(err).toBeEcosystemError('query-builder/invalid-value')
    expect((err as Error).message).toContain('"open" | "closed" | "archived"')
  })
})

describe('parse: error locations', () => {
  it('points at the offending node deep in the tree', () => {
    const bad = group(condition, group(condition, group({ ...condition, field: 'nope' })))

    const err = captureError(() => parse(bad, schema))

    expect((err as Error).message).toContain('root.children[1].children[1].children[0]')
  })

  it('formats the root as "root"', () => {
    expect(formatPath([])).toBe('root')
    expect(formatPath([2, 0])).toBe('root.children[2].children[0]')
  })
})

describe('validate', () => {
  it('returns null for a valid query', () => {
    expect(validate(group(condition), schema)).toBeNull()
  })

  it('returns the error rather than throwing', () => {
    const issue = validate(group({ ...condition, field: 'nope' }), schema)

    expect(issue).toBeEcosystemError('query-builder/unknown-field')
  })

  it('does not treat a string as JSON -- only parse() does that', () => {
    // `validate` takes a node, not a document. A caller with a string should
    // reach for `parse` and catch, which is what the composable does.
    expect(validate(serialise(group(condition) as QueryAst), schema)).toBeEcosystemError(
      'query-builder/malformed-node',
    )
  })
})
