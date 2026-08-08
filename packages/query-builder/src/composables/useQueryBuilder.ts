import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { createLogger } from '@vue-ecosystem/core'
import {
  emptyQuery,
  type Combinator,
  type Group,
  type OperatorsFor,
  type QueryAst,
  type QueryNode,
  type Schema,
} from '../internal/ast'
import { createQuery, type OperandArgs } from '../internal/builder'
import type { NodePath, QueryBuilderError } from '../internal/errors'
import { evaluate, type EvaluateOptions, type QueryRecord } from '../internal/evaluate'
import { appendNode, removeNode, replaceNode, setCombinator, setNegate } from '../internal/mutate'
import { parse, serialise, validate } from '../internal/serialise'

const logger = createLogger('query-builder').extend('useQueryBuilder')

export interface UseQueryBuilderOptions {
  /**
   * Starting query: an AST, or the JSON string one was serialised to.
   *
   * A string is run through `parse()`, so a malformed saved view surfaces as a
   * warning and an empty query rather than as a crash during `setup()`.
   */
  readonly initial?: QueryAst | string
  /** Combinator for the root group when no `initial` is given. Defaults to `'and'`. */
  readonly combinator?: Combinator
  /** Passed straight through to {@link evaluate} by `matches()`. */
  readonly evaluate?: EvaluateOptions
}

export interface UseQueryBuilderReturn<S extends Schema> {
  /** The live AST. Plain JSON at every moment -- safe to `JSON.stringify` directly. */
  readonly ast: Ref<QueryAst>
  /** `serialise(ast)`, recomputed on change. Ready for a URL, a form field or a POST body. */
  readonly serialised: ComputedRef<string>
  /** `true` when the AST validates against the schema. */
  readonly isValid: ComputedRef<boolean>
  /** The first validation failure, or `null`. `isValid` is `error === null`. */
  readonly error: ComputedRef<QueryBuilderError | null>

  /**
   * Append a condition to the group at `path` (`[]` is the root).
   *
   * Typed exactly like the builder's `where()`: the operator argument is
   * constrained by the field's kind, so a wrong pairing fails to compile.
   */
  addCondition<F extends keyof S & string, Op extends OperatorsFor[S[F]['kind']] & string>(
    path: NodePath,
    field: F,
    operator: Op,
    ...operand: OperandArgs<S[F], Op>
  ): void

  /** Append an empty nested group to the group at `path`. */
  addGroup(path: NodePath, combinator?: Combinator, negate?: boolean): void

  /** Replace the node at `path` wholesale. */
  updateNode(path: NodePath, node: QueryNode): void

  /** Replace the condition at `path` with a freshly built one. */
  updateCondition<F extends keyof S & string, Op extends OperatorsFor[S[F]['kind']] & string>(
    path: NodePath,
    field: F,
    operator: Op,
    ...operand: OperandArgs<S[F], Op>
  ): void

  /** Remove the node at `path`. The root cannot be removed -- use `reset()`. */
  remove(path: NodePath): void

  setCombinator(path: NodePath, combinator: Combinator): void
  setNegate(path: NodePath, negate: boolean): void

  /** Back to an empty query with the original root combinator. */
  reset(): void

  /** `evaluate(ast, record)` against the current AST. */
  matches(record: QueryRecord): boolean
}

/**
 * Reactive wrapper over the builder.
 *
 * Deliberately thin: every method is a `ref` assignment around a pure function
 * from `internal/`. Nothing here decides anything -- the AST rules, the
 * validation and the evaluation semantics all live in modules that can be
 * tested without a component. If a bug in this file is ever anything other than
 * a wiring mistake, logic has leaked upwards and belongs back down.
 *
 * ```ts
 * const schema = defineSchema({ title: { kind: 'string' }, priority: { kind: 'number' } })
 * const q = useQueryBuilder(schema)
 *
 * q.addCondition([], 'title', 'contains', 'invoice')
 * q.addGroup([], 'or')
 * q.addCondition([1], 'priority', 'gte', 3)
 *
 * q.matches({ title: 'Invoice #4', priority: 5 }) // true
 * ```
 */
export function useQueryBuilder<const S extends Schema>(
  schema: S,
  options: UseQueryBuilderOptions = {},
): UseQueryBuilderReturn<S> {
  const rootCombinator = options.combinator ?? 'and'
  const evaluateOptions = options.evaluate ?? {}

  const ast = ref<QueryAst>(readInitial(schema, options.initial, rootCombinator)) as Ref<QueryAst>

  // One validation pass feeds both `error` and `isValid`; `computed` caches it,
  // so a template reading both does not validate the tree twice. `computed`
  // does not deep-proxy what it returns, so the Error instance stays a plain
  // Error rather than becoming a reactive proxy of one.
  const validationError = computed<QueryBuilderError | null>(() => validate(ast.value, schema))

  function build<F extends keyof S & string, Op extends OperatorsFor[S[F]['kind']] & string>(
    field: F,
    operator: Op,
    operand: readonly unknown[],
  ): QueryNode {
    const builder = createQuery(schema)
    // The rest-tuple type is enforced at every public call site; inside, the
    // operand is already erased to `unknown[]`, so this cast reasserts what the
    // caller's signature guaranteed rather than widening anything.
    ;(builder.where as (f: string, o: string, ...rest: readonly unknown[]) => unknown)(
      field,
      operator,
      ...operand,
    )
    const built = builder.build()
    return built.children[0] as QueryNode
  }

  return {
    ast,
    serialised: computed(() => serialise(ast.value)),
    isValid: computed(() => validationError.value === null),
    error: validationError,

    addCondition(path, field, operator, ...operand) {
      ast.value = appendNode(ast.value, path, build(field, operator, operand))
    },

    addGroup(path, combinator = 'and', negate = false) {
      const group: Group = { type: 'group', combinator, negate, children: [] }
      ast.value = appendNode(ast.value, path, group)
    },

    updateNode(path, node) {
      ast.value = replaceNode(ast.value, path, node)
    },

    updateCondition(path, field, operator, ...operand) {
      ast.value = replaceNode(ast.value, path, build(field, operator, operand))
    },

    remove(path) {
      ast.value = removeNode(ast.value, path)
    },

    setCombinator(path, combinator) {
      ast.value = setCombinator(ast.value, path, combinator)
    },

    setNegate(path, negate) {
      ast.value = setNegate(ast.value, path, negate)
    },

    reset() {
      ast.value = emptyQuery(rootCombinator)
    },

    matches(record) {
      return evaluate(ast.value, record, evaluateOptions)
    },
  }
}

/**
 * Resolve the `initial` option.
 *
 * A bad saved query warns and falls back to empty rather than throwing. This
 * runs inside `setup()`, where an exception takes the whole component down --
 * and the most likely source of a bad query is a saved view from an older
 * schema, which is a recoverable situation, not a programming error.
 */
function readInitial(
  schema: Schema,
  initial: QueryAst | string | undefined,
  combinator: Combinator,
): QueryAst {
  if (initial === undefined) return emptyQuery(combinator)

  try {
    return parse(initial, schema)
  } catch (err) {
    logger.warn('discarding invalid `initial` query and starting empty:', err)
    return emptyQuery(combinator)
  }
}
