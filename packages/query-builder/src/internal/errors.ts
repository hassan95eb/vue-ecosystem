import { EcosystemError } from '@vue-ecosystem/core'

export class QueryBuilderError extends EcosystemError {}

/**
 * Where in the AST a problem was found, rendered for a human: `root.children[2]`.
 *
 * A message that says only "unknown operator" is useless against a 30-node tree
 * pasted in from a saved view, so every parse/validation error carries one.
 */
export type NodePath = readonly number[]

export function formatPath(path: NodePath): string {
  return path.length === 0 ? 'root' : `root${path.map((i) => `.children[${i}]`).join('')}`
}

export function malformedJson(cause: unknown): QueryBuilderError {
  return new QueryBuilderError(
    `Query is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
    { code: 'query-builder/malformed-json', cause },
  )
}

export function malformedNode(path: NodePath, reason: string): QueryBuilderError {
  return new QueryBuilderError(`${formatPath(path)} is not a valid query node: ${reason}.`, {
    code: 'query-builder/malformed-node',
    details: { path, reason },
  })
}

export function unknownField(
  path: NodePath,
  field: string,
  known: readonly string[],
): QueryBuilderError {
  return new QueryBuilderError(
    `${formatPath(path)} references unknown field '${field}'. Known fields: ${known.join(', ') || '(none)'}.`,
    { code: 'query-builder/unknown-field', details: { path, field, known } },
  )
}

export function unknownOperator(
  path: NodePath,
  operator: string,
  field: string,
  kind: string,
  allowed: readonly string[],
): QueryBuilderError {
  return new QueryBuilderError(
    `${formatPath(path)} uses operator '${operator}', which is not legal for ${kind} field '${field}'. ` +
      `Legal operators: ${allowed.join(', ')}.`,
    { code: 'query-builder/unknown-operator', details: { path, operator, field, kind, allowed } },
  )
}

export function invalidValue(
  path: NodePath,
  field: string,
  operator: string,
  expected: string,
  received: unknown,
): QueryBuilderError {
  return new QueryBuilderError(
    `${formatPath(path)}: field '${field}' with operator '${operator}' expects ${expected}, ` +
      `received ${describe(received)}.`,
    { code: 'query-builder/invalid-value', details: { path, field, operator, expected, received } },
  )
}

export function invalidSchema(field: string, reason: string): QueryBuilderError {
  return new QueryBuilderError(`Schema field '${field}' is invalid: ${reason}.`, {
    code: 'query-builder/invalid-schema',
    details: { field, reason },
  })
}

export function invalidPath(path: NodePath, reason: string): QueryBuilderError {
  return new QueryBuilderError(`No node at ${formatPath(path)}: ${reason}.`, {
    code: 'query-builder/invalid-path',
    details: { path, reason },
  })
}

/** Defensive: only reachable if an AST bypassed both the builder and `parse`. */
export function unsupportedOperator(operator: string): QueryBuilderError {
  return new QueryBuilderError(
    `Cannot evaluate unsupported operator '${operator}'. Build the AST with the builder or run it ` +
      `through parse() first.`,
    { code: 'query-builder/unsupported-operator', details: { operator } },
  )
}

/** Short, non-throwing description of an arbitrary value, for error prose. */
function describe(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return `an array of length ${value.length}`
  if (typeof value === 'string') return `the string ${JSON.stringify(value)}`
  if (typeof value === 'object') return 'an object'
  return `the ${typeof value} ${String(value)}`
}
