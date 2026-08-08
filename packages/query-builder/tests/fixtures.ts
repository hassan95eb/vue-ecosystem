import { defineSchema, OPERATORS_BY_KIND, type FieldKind, type QueryAst } from '../src'
import { createQuery, type QueryBuilder } from '../src/internal/builder'

/** One field per kind, used by every suite so the cases line up across files. */
export const schema = defineSchema({
  title: { kind: 'string' },
  priority: { kind: 'number' },
  active: { kind: 'boolean' },
  createdAt: { kind: 'date' },
  status: { kind: 'enum', values: ['open', 'closed', 'archived'] },
})

export type TestSchema = typeof schema

/**
 * `where()` with the types erased.
 *
 * The generator below picks its field and operator at runtime, so the typed
 * signature -- which is the whole point of the builder everywhere else -- has
 * nothing to bite on here. Erasing it in one named place keeps the casts out of
 * the test bodies.
 */
export type LooseWhere = (field: string, operator: string, ...operand: readonly unknown[]) => void

export function looseWhere(builder: QueryBuilder<TestSchema>): LooseWhere {
  return builder.where as unknown as LooseWhere
}

/**
 * Deterministic PRNG (mulberry32).
 *
 * A property test that cannot be replayed is a flake generator; with a fixed
 * seed a failing case is reproducible from the seed printed in the test name.
 */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T
}

const VALUE_POOL: Readonly<Record<FieldKind, readonly unknown[]>> = {
  string: ['invoice', 'Refund', 'ünïcode', 'q1-report', ''],
  number: [0, -12.5, 3, 1_000_000],
  boolean: [true, false],
  date: ['2024-01-01T00:00:00.000Z', '2024-06-15T09:30:00.000Z', '2025-12-31T23:59:59.000Z'],
  enum: ['open', 'closed', 'archived'],
}

/**
 * A random AST that the builder could have produced -- i.e. every node is a
 * legal (kind, operator, operand) triple. That constraint is what makes the
 * round-trip test meaningful: it asserts serialisation is lossless over the
 * whole space of *valid* queries, not over arbitrary JSON.
 */
export function randomAst(random: () => number): QueryAst {
  const builder = createQuery(schema, {
    combinator: random() < 0.5 ? 'and' : 'or',
    negate: random() < 0.3,
  })
  fill(builder, random, 0)
  return builder.build()
}

function fill(builder: QueryBuilder<TestSchema>, random: () => number, depth: number): void {
  const childCount = Math.floor(random() * 4)

  for (let i = 0; i < childCount; i += 1) {
    if (depth < 3 && random() < 0.3) {
      builder.group(random() < 0.5 ? 'and' : 'or', (nested) => fill(nested, random, depth + 1), {
        negate: random() < 0.3,
      })
      continue
    }

    addRandomCondition(builder, random)
  }
}

function addRandomCondition(builder: QueryBuilder<TestSchema>, random: () => number): void {
  const field = pick(random, Object.keys(schema)) as keyof TestSchema
  const kind: FieldKind = schema[field].kind
  const operator = pick<string>(random, OPERATORS_BY_KIND[kind])
  const where = looseWhere(builder)
  const pool = VALUE_POOL[kind]

  if (operator === 'isNull' || operator === 'isNotNull') {
    where(field, operator)
  } else if (operator === 'in' || operator === 'notIn' || operator === 'between') {
    where(field, operator, [pick(random, pool), pick(random, pool)])
  } else {
    where(field, operator, pick(random, pool))
  }
}

/** Every leaf of a JSON-safe tree, for the "plain JSON, nothing exotic" assertion. */
export function collectLeaves(value: unknown, out: unknown[] = []): unknown[] {
  if (Array.isArray(value)) {
    for (const entry of value) collectLeaves(entry, out)
    return out
  }
  if (typeof value === 'object' && value !== null) {
    for (const entry of Object.values(value)) collectLeaves(entry, out)
    return out
  }
  out.push(value)
  return out
}
