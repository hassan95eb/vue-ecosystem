import { describe, expect, it } from 'vitest'
import { createQuery, parse, serialise, validate, type QueryAst } from '../src'
import { collectLeaves, randomAst, rng, schema } from './fixtures'

/**
 * The property this package sells: **any AST the builder can produce survives
 * `serialise` -> `parse` and deep-equals the original.**
 *
 * Property-style rather than example-based, because the failure modes are
 * combinatorial -- a `value: undefined` on one unary operator, a `Date` that
 * only appears for one field kind, a nested group at depth three. 400 seeded
 * trees cover a lot more of that space than any hand-written list, and the seed
 * is in the test name so a failure replays exactly.
 */
const ITERATIONS = 400

describe('round trip', () => {
  it(`survives serialise -> parse for ${ITERATIONS} generated queries`, () => {
    for (let seed = 1; seed <= ITERATIONS; seed += 1) {
      const ast = randomAst(rng(seed))

      const restored = parse(serialise(ast), schema)

      // `toStrictEqual`, not `toEqual`: `toEqual` treats a property that is
      // present-but-undefined as equal to an absent one, which is exactly the
      // bug this test exists to catch on the unary operators.
      expect(restored, `seed ${seed}`).toStrictEqual(ast)
    }
  })

  it(`survives a bare JSON.stringify -> JSON.parse for ${ITERATIONS} generated queries`, () => {
    for (let seed = 1; seed <= ITERATIONS; seed += 1) {
      const ast = randomAst(rng(seed))

      expect(JSON.parse(JSON.stringify(ast)), `seed ${seed}`).toStrictEqual(ast)
    }
  })

  it('contains nothing but JSON primitives -- no Date, no class instance, no undefined', () => {
    for (let seed = 1; seed <= ITERATIONS; seed += 1) {
      for (const leaf of collectLeaves(randomAst(rng(seed)))) {
        expect(['string', 'number', 'boolean'], `seed ${seed}`).toContain(typeof leaf)
      }
    }
  })

  it('produces only queries that validate against the schema', () => {
    for (let seed = 1; seed <= ITERATIONS; seed += 1) {
      expect(validate(randomAst(rng(seed)), schema), `seed ${seed}`).toBeNull()
    }
  })

  it('is stable across repeated round trips', () => {
    const original = randomAst(rng(7))
    let current: QueryAst = original

    for (let i = 0; i < 5; i += 1) current = parse(serialise(current), schema)

    expect(current).toStrictEqual(original)
  })

  it('omits the value key entirely for unary operators', () => {
    const ast = createQuery(schema).where('title', 'isNull').build()
    const condition = ast.children[0] as Record<string, unknown>

    expect('value' in condition).toBe(false)
    expect(serialise(ast)).not.toContain('value')
  })

  it('accepts an already-parsed object as well as a JSON string', () => {
    const ast = randomAst(rng(11))

    expect(parse(JSON.parse(serialise(ast)), schema)).toStrictEqual(ast)
  })

  it('hands back a fresh copy from every build(), so an earlier AST cannot be mutated', () => {
    const builder = createQuery(schema).where('title', 'eq', 'a')
    const first = builder.build()

    builder.where('priority', 'gt', 1)
    const second = builder.build()

    expect(first.children).toHaveLength(1)
    expect(second.children).toHaveLength(2)
  })
})
