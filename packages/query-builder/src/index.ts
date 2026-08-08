// Public API surface. No logic here by design -- the exports map and the
// `internal/` boundary lint rule both point at exactly this file.

// --- The AST and the schema that types it -------------------------------
export { defineSchema, emptyQuery, isCondition, isGroup, OPERATORS_BY_KIND } from './internal/ast'
export type {
  Combinator,
  Condition,
  FieldDef,
  FieldKind,
  FieldValue,
  Group,
  ListOperator,
  Operator,
  OperatorsFor,
  QueryAst,
  QueryNode,
  RangeOperator,
  ScalarOperator,
  Schema,
  UnaryOperator,
} from './internal/ast'

// --- Building -----------------------------------------------------------
export { createQuery } from './internal/builder'
export type { OperandArgs, QueryBuilder } from './internal/builder'

// --- Serialising and validating -----------------------------------------
export { parse, serialise, validate } from './internal/serialise'

// --- Evaluating ---------------------------------------------------------
// Pure, framework-agnostic, no Vue import. Exported from the root specifically
// so `smart-table` filters rows through this rather than reimplementing AST
// traversal inline -- see the evaluate() semantics section of the README.
export { evaluate } from './internal/evaluate'
export type { EvaluateOptions, QueryRecord } from './internal/evaluate'

// --- Editing an existing AST --------------------------------------------
// Immutable, path-addressed. The composable is built on these; they are
// exported because a consumer with its own state layer (Pinia, a URL store)
// needs the same operations without the ref.
export {
  appendNode,
  findGroup,
  findNode,
  removeNode,
  replaceNode,
  setCombinator,
  setNegate,
  updateGroup,
} from './internal/mutate'

// --- The composable -----------------------------------------------------
export { useQueryBuilder } from './composables/useQueryBuilder'
export type { UseQueryBuilderOptions, UseQueryBuilderReturn } from './composables/useQueryBuilder'

// --- Errors -------------------------------------------------------------
export { QueryBuilderError, formatPath } from './internal/errors'
export type { NodePath } from './internal/errors'
