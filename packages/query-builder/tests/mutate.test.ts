import { describe, expect, it } from 'vitest'
import {
  appendNode,
  createQuery,
  findGroup,
  findNode,
  removeNode,
  replaceNode,
  setCombinator,
  setNegate,
  updateGroup,
  type QueryAst,
  type QueryNode,
} from '../src'
import { schema } from './fixtures'

function captureError(fn: () => unknown): unknown {
  try {
    fn()
  } catch (err) {
    return err
  }
  return '<did not throw>'
}

/** root: [ title-eq, or-group: [ priority-gt, and-group: [ active-eq ] ] ] */
function fixture(): QueryAst {
  return createQuery(schema)
    .where('title', 'eq', 'a')
    .any((outer) =>
      outer.where('priority', 'gt', 1).all((inner) => inner.where('active', 'eq', true)),
    )
    .build()
}

const newCondition: QueryNode = {
  type: 'condition',
  field: 'status',
  kind: 'enum',
  operator: 'eq',
  value: 'open',
}

describe('findNode', () => {
  it('returns the root for an empty path', () => {
    const ast = fixture()
    expect(findNode(ast, [])).toBe(ast)
  })

  it('walks nested children', () => {
    expect(findNode(fixture(), [1, 1, 0])).toMatchObject({ field: 'active' })
  })

  it('returns null for an out-of-range index', () => {
    expect(findNode(fixture(), [9])).toBeNull()
  })

  it('returns null when the path descends into a condition', () => {
    expect(findNode(fixture(), [0, 0])).toBeNull()
  })

  it('findGroup returns null when the path addresses a condition', () => {
    expect(findGroup(fixture(), [0])).toBeNull()
    expect(findGroup(fixture(), [1])).toMatchObject({ combinator: 'or' })
  })
})

describe('immutability', () => {
  it('never mutates the input tree', () => {
    const ast = fixture()
    const before = JSON.stringify(ast)

    appendNode(ast, [], newCondition)
    removeNode(ast, [0])
    setNegate(ast, [1], true)
    setCombinator(ast, [], 'or')

    expect(JSON.stringify(ast)).toBe(before)
  })

  it('shares the untouched subtrees rather than deep-copying', () => {
    // Structural sharing is what keeps an undo stack cheap, and it is easy to
    // lose to a stray JSON round trip -- so it is asserted, not assumed.
    const ast = fixture()
    const updated = setNegate(ast, [1, 1], true)

    expect(updated).not.toBe(ast)
    expect(updated.children[0]).toBe(ast.children[0])
  })
})

describe('appendNode', () => {
  it('appends to the root', () => {
    const updated = appendNode(fixture(), [], newCondition)
    expect(updated.children).toHaveLength(3)
    expect(updated.children[2]).toBe(newCondition)
  })

  it('appends to a nested group', () => {
    const updated = appendNode(fixture(), [1, 1], newCondition)
    expect(findGroup(updated, [1, 1])?.children).toHaveLength(2)
  })

  it('refuses to append to a condition', () => {
    expect(captureError(() => appendNode(fixture(), [0], newCondition))).toBeEcosystemError(
      'query-builder/invalid-path',
    )
  })

  it('refuses an out-of-range path', () => {
    expect(captureError(() => appendNode(fixture(), [9], newCondition))).toBeEcosystemError(
      'query-builder/invalid-path',
    )
  })
})

describe('removeNode', () => {
  it('removes a top-level child', () => {
    const updated = removeNode(fixture(), [0])
    expect(updated.children).toHaveLength(1)
    expect(updated.children[0]).toMatchObject({ combinator: 'or' })
  })

  it('removes a deeply nested child, leaving an empty group behind', () => {
    const updated = removeNode(fixture(), [1, 1, 0])
    expect(findGroup(updated, [1, 1])?.children).toStrictEqual([])
  })

  it('refuses to remove the root', () => {
    const err = captureError(() => removeNode(fixture(), []))

    expect(err).toBeEcosystemError('query-builder/invalid-path')
    expect((err as Error).message).toContain('root group cannot be removed')
  })

  it('refuses an out-of-range index', () => {
    expect(captureError(() => removeNode(fixture(), [5]))).toBeEcosystemError(
      'query-builder/invalid-path',
    )
  })
})

describe('replaceNode', () => {
  it('replaces a nested node', () => {
    const updated = replaceNode(fixture(), [1, 0], newCondition)
    expect(findNode(updated, [1, 0])).toBe(newCondition)
  })

  it('replaces the whole tree when the path is empty', () => {
    const next = createQuery(schema).build()
    expect(replaceNode(fixture(), [], next)).toBe(next)
  })

  it('refuses to put a condition at the root', () => {
    expect(captureError(() => replaceNode(fixture(), [], newCondition))).toBeEcosystemError(
      'query-builder/invalid-path',
    )
  })

  it('refuses an out-of-range index', () => {
    expect(captureError(() => replaceNode(fixture(), [1, 7], newCondition))).toBeEcosystemError(
      'query-builder/invalid-path',
    )
  })
})

describe('setCombinator / setNegate / updateGroup', () => {
  it('flips a nested combinator', () => {
    expect(findGroup(setCombinator(fixture(), [1], 'and'), [1])?.combinator).toBe('and')
  })

  it('negates a nested group', () => {
    expect(findGroup(setNegate(fixture(), [1], true), [1])?.negate).toBe(true)
  })

  it('applies an arbitrary patch', () => {
    const updated = updateGroup(fixture(), [], (group) => ({ ...group, children: [] }))
    expect(updated.children).toStrictEqual([])
  })

  it('refuses to patch a condition', () => {
    expect(captureError(() => updateGroup(fixture(), [0], (group) => group))).toBeEcosystemError(
      'query-builder/invalid-path',
    )
  })
})
