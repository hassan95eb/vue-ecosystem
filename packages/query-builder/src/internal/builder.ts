/**
 * The fluent builder.
 *
 * Its job is not to save keystrokes -- an AST literal is barely longer. Its job
 * is that `.where('age', 'contains', 'x')` is a **compile** error, because the
 * operator argument is typed as `OperatorsFor[<kind of 'age'>]` and `'contains'`
 * is not in the `number` set. The same table drives the runtime check in
 * `parse()`, so a query assembled in TypeScript and a query loaded from a saved
 * view are held to one rule.
 */

import {
  emptyQuery,
  isListOperator,
  isRangeOperator,
  isUnaryOperator,
  type Combinator,
  type FieldDef,
  type FieldValue,
  type Group,
  type ListOperator,
  type OperatorsFor,
  type QueryAst,
  type QueryNode,
  type RangeOperator,
  type Schema,
  type UnaryOperator,
} from './ast'
import { unknownField, type NodePath } from './errors'
import { validateNodeAt } from './serialise'

/**
 * The operand argument list for a (field, operator) pair, as a rest tuple.
 *
 * Unary operators take **no** argument at all -- not an optional one -- which
 * is what stops `.where('name', 'isNull', 'oops')` from type-checking and keeps
 * the node's `value` key genuinely absent.
 */
export type OperandArgs<D extends FieldDef, Op extends string> = Op extends UnaryOperator
  ? []
  : Op extends ListOperator
    ? [values: readonly FieldValue<D>[]]
    : Op extends RangeOperator
      ? [range: readonly [FieldValue<D>, FieldValue<D>]]
      : [value: FieldValue<D>]

export interface QueryBuilder<S extends Schema> {
  readonly schema: S

  /**
   * Add a condition to this group.
   *
   * @throws {@link QueryBuilderError} `query-builder/unknown-field` or
   * `query-builder/invalid-value` -- the runtime backstop for callers coming
   * from plain JavaScript, where the type-level rules do not apply.
   */
  where<F extends keyof S & string, Op extends OperatorsFor[S[F]['kind']] & string>(
    field: F,
    operator: Op,
    ...operand: OperandArgs<S[F], Op>
  ): QueryBuilder<S>

  /** Add a nested group, populated by `build`. */
  group(
    combinator: Combinator,
    build: (nested: QueryBuilder<S>) => void,
    options?: { readonly negate?: boolean },
  ): QueryBuilder<S>

  /** Sugar for `group('and', ...)`. */
  all(build: (nested: QueryBuilder<S>) => void): QueryBuilder<S>

  /** Sugar for `group('or', ...)`. */
  any(build: (nested: QueryBuilder<S>) => void): QueryBuilder<S>

  /** Negate *this* group. `negate()` with no argument sets it to `true`. */
  negate(value?: boolean): QueryBuilder<S>

  /**
   * Snapshot the group as a plain JSON AST.
   *
   * Returns a fresh deep copy every call, so continuing to use the builder
   * afterwards cannot mutate an AST already handed out. The copy goes through
   * `JSON.parse(JSON.stringify(...))`, which also means `build()` would visibly
   * fail if a non-JSON value ever found its way into a node.
   */
  build(): QueryAst
}

/**
 * Start a query against a schema.
 *
 * ```ts
 * const schema = defineSchema({
 *   title: { kind: 'string' },
 *   priority: { kind: 'number' },
 *   status: { kind: 'enum', values: ['open', 'closed'] },
 * })
 *
 * const ast = createQuery(schema)
 *   .where('title', 'contains', 'invoice')
 *   .where('priority', 'gte', 3)
 *   .any((g) => g.where('status', 'eq', 'open').where('status', 'isNull'))
 *   .build()
 * ```
 */
export function createQuery<const S extends Schema>(
  schema: S,
  options: { readonly combinator?: Combinator; readonly negate?: boolean } = {},
): QueryBuilder<S> {
  return createGroupBuilder(schema, options.combinator ?? 'and', options.negate ?? false, [])
}

function createGroupBuilder<S extends Schema>(
  schema: S,
  combinator: Combinator,
  negated: boolean,
  path: NodePath,
): QueryBuilder<S> {
  const children: QueryNode[] = []
  let isNegated = negated

  const builder: QueryBuilder<S> = {
    schema,

    where(field, operator, ...operand) {
      if (!Object.prototype.hasOwnProperty.call(schema, field)) {
        throw unknownField([...path, children.length], field, Object.keys(schema))
      }
      const def = schema[field] as FieldDef

      const node = createConditionNode(field, def, operator, operand)
      const issue = validateNodeAt(node, schema, [...path, children.length])
      if (issue !== null) throw issue

      children.push(node as QueryNode)
      return builder
    },

    group(nestedCombinator, build, groupOptions = {}) {
      const nested = createGroupBuilder(schema, nestedCombinator, groupOptions.negate ?? false, [
        ...path,
        children.length,
      ])
      build(nested)
      children.push(nested.build())
      return builder
    },

    all(build) {
      return builder.group('and', build)
    },

    any(build) {
      return builder.group('or', build)
    },

    negate(value = true) {
      isNegated = value
      return builder
    },

    build() {
      const snapshot: Group = {
        type: 'group',
        combinator,
        negate: isNegated,
        children: [...children],
      }
      return JSON.parse(JSON.stringify(snapshot)) as QueryAst
    },
  }

  return builder
}

/**
 * Assemble the node.
 *
 * Split out because the `value` key must be **omitted** for unary operators
 * rather than set to `undefined` -- see the round-trip note at the top of
 * `ast.ts`. Building the object conditionally is the only way to express that.
 */
function createConditionNode(
  field: string,
  def: FieldDef,
  operator: string,
  operand: readonly unknown[],
): Record<string, unknown> {
  const base = { type: 'condition', field, kind: def.kind, operator }

  if (isUnaryOperator(operator)) return base

  const value = operand[0]

  if (isListOperator(operator)) {
    return { ...base, value: Array.isArray(value) ? [...value] : value }
  }
  if (isRangeOperator(operator)) {
    return { ...base, value: Array.isArray(value) ? [...value] : value }
  }
  return { ...base, value }
}

export { emptyQuery }
