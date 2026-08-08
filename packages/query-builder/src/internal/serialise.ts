/**
 * Validation, `parse()` and `serialise()`.
 *
 * `serialise` is deliberately a thin wrapper over `JSON.stringify` -- if it
 * ever needed to be more than that, the AST would have stopped being plain
 * JSON and the round-trip guarantee would already be broken. It exists so the
 * pair reads symmetrically at the call site and so there is one place to add a
 * version tag if the node shape ever changes.
 */

import {
  OPERATORS_BY_KIND,
  isListOperator,
  isRangeOperator,
  isUnaryOperator,
  type FieldDef,
  type QueryAst,
  type Schema,
} from './ast'
import {
  invalidValue,
  malformedJson,
  malformedNode,
  unknownField,
  unknownOperator,
  type NodePath,
  type QueryBuilderError,
} from './errors'

const COMBINATORS: readonly string[] = ['and', 'or']

/** ISO 8601 is only useful as a wire format if it actually parses to an instant. */
export function parseInstant(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isNaN(ms) ? null : ms
  }
  if (typeof value !== 'string') return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

export function serialise(ast: QueryAst): string {
  return JSON.stringify(ast)
}

/**
 * Validate an unknown value against a schema and return it as a typed AST.
 *
 * Accepts either a JSON string or an already-parsed object, so both
 * `parse(localStorage.getItem('view'), schema)` and
 * `parse(await res.json(), schema)` work without a caller-side branch.
 *
 * The returned object is the *same* object that was passed in (or the direct
 * result of `JSON.parse`), not a copy: validation proves the shape, it does not
 * rebuild it. That is what keeps `parse(serialise(ast))` deep-equal to `ast`.
 *
 * @throws {@link QueryBuilderError} `query-builder/malformed-json`,
 * `query-builder/malformed-node`, `query-builder/unknown-field`,
 * `query-builder/unknown-operator` or `query-builder/invalid-value`.
 */
export function parse(input: unknown, schema: Schema): QueryAst {
  let candidate = input

  if (typeof input === 'string') {
    try {
      candidate = JSON.parse(input)
    } catch (err) {
      throw malformedJson(err)
    }
  }

  const issue = validateNode(candidate, schema, [], true)
  if (issue !== null) throw issue

  return candidate as QueryAst
}

/**
 * Non-throwing counterpart to {@link parse}: returns the first problem, or
 * `null` if the tree is valid.
 *
 * The composable's `isValid` is built on this. A UI that redraws on every
 * keystroke should not be constructing and catching exceptions to decide
 * whether to grey out a button.
 */
export function validate(input: unknown, schema: Schema): QueryBuilderError | null {
  return validateNode(input, schema, [], true)
}

/**
 * Validate a single node in isolation, at a known position.
 *
 * The builder uses this to fail on the `.where()` call that produced the bad
 * node, with the path the node *will* occupy in the finished tree -- rather
 * than at `build()`, by which point the offending call site is gone.
 */
export function validateNodeAt(
  node: unknown,
  schema: Schema,
  path: NodePath,
): QueryBuilderError | null {
  return validateNode(node, schema, path, false)
}

function validateNode(
  node: unknown,
  schema: Schema,
  path: NodePath,
  mustBeGroup: boolean,
): QueryBuilderError | null {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    return malformedNode(path, 'expected an object')
  }

  const record = node as Record<string, unknown>

  if (mustBeGroup && record['type'] !== 'group') {
    return malformedNode(path, 'the root of a query must be a group, not a bare condition')
  }

  if (record['type'] === 'group') return validateGroup(record, schema, path)
  if (record['type'] === 'condition') return validateCondition(record, schema, path)

  return malformedNode(
    path,
    `\`type\` must be 'group' or 'condition', received ${describeType(record['type'])}`,
  )
}

function validateGroup(
  record: Record<string, unknown>,
  schema: Schema,
  path: NodePath,
): QueryBuilderError | null {
  if (!COMBINATORS.includes(record['combinator'] as string)) {
    return malformedNode(
      path,
      `\`combinator\` must be 'and' or 'or', received ${describeType(record['combinator'])}`,
    )
  }
  if (typeof record['negate'] !== 'boolean') {
    return malformedNode(
      path,
      `\`negate\` must be present and boolean, received ${describeType(record['negate'])}`,
    )
  }
  const children = record['children']
  if (!Array.isArray(children)) {
    return malformedNode(path, `\`children\` must be an array, received ${describeType(children)}`)
  }

  for (let i = 0; i < children.length; i += 1) {
    const issue = validateNode(children[i], schema, [...path, i], false)
    if (issue !== null) return issue
  }

  return null
}

function validateCondition(
  record: Record<string, unknown>,
  schema: Schema,
  path: NodePath,
): QueryBuilderError | null {
  const field = record['field']
  if (typeof field !== 'string') {
    return malformedNode(path, `\`field\` must be a string, received ${describeType(field)}`)
  }

  const def = Object.prototype.hasOwnProperty.call(schema, field) ? schema[field] : undefined
  if (def === undefined) return unknownField(path, field, Object.keys(schema))

  // `kind` is denormalised onto the node so a consumer (smart-table's filter
  // chips, for instance) can render a condition without also holding the
  // schema. It is therefore validated against the schema rather than trusted.
  if (record['kind'] !== def.kind) {
    return malformedNode(
      path,
      `\`kind\` is ${describeType(record['kind'])} but field '${field}' is declared as '${def.kind}' in the schema`,
    )
  }

  const operator = record['operator']
  if (typeof operator !== 'string') {
    return malformedNode(path, `\`operator\` must be a string, received ${describeType(operator)}`)
  }

  const allowed: readonly string[] = OPERATORS_BY_KIND[def.kind]
  if (!allowed.includes(operator)) {
    return unknownOperator(path, operator, field, def.kind, allowed)
  }

  return validateValue(record, def, field, operator, path)
}

function validateValue(
  record: Record<string, unknown>,
  def: FieldDef,
  field: string,
  operator: string,
  path: NodePath,
): QueryBuilderError | null {
  const hasValueKey = Object.prototype.hasOwnProperty.call(record, 'value')
  const value = record['value']

  if (isUnaryOperator(operator)) {
    // Not merely "value is ignored": the key must be absent, because
    // `JSON.stringify` deletes `undefined` properties and a node carrying
    // `value: undefined` would not survive its own round trip.
    if (hasValueKey) {
      return malformedNode(
        path,
        `operator '${operator}' takes no operand, so the \`value\` key must be absent (it was present)`,
      )
    }
    return null
  }

  if (!hasValueKey) {
    return invalidValue(path, field, operator, `a ${def.kind} operand`, undefined)
  }

  if (isListOperator(operator)) {
    if (!Array.isArray(value)) {
      return invalidValue(path, field, operator, `an array of ${def.kind} values`, value)
    }
    if (value.length === 0) {
      return invalidValue(path, field, operator, 'a non-empty array', value)
    }
    for (const entry of value) {
      if (!isValidScalar(entry, def)) {
        return invalidValue(path, field, operator, `an array of ${describeExpected(def)}`, entry)
      }
    }
    return null
  }

  if (isRangeOperator(operator)) {
    if (!Array.isArray(value) || value.length !== 2) {
      return invalidValue(path, field, operator, 'a [min, max] pair', value)
    }
    for (const entry of value) {
      if (!isValidScalar(entry, def)) {
        return invalidValue(
          path,
          field,
          operator,
          `a [min, max] pair of ${describeExpected(def)}`,
          entry,
        )
      }
    }
    return null
  }

  if (!isValidScalar(value, def)) {
    return invalidValue(path, field, operator, describeExpected(def), value)
  }

  return null
}

export function isValidScalar(value: unknown, def: FieldDef): boolean {
  switch (def.kind) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'date':
      // An unparseable date *in the query* is a hard error, unlike an
      // unparseable date on a record, which is only a non-match. The query is
      // authored; the data is found.
      return typeof value === 'string' && parseInstant(value) !== null
    case 'enum':
      return typeof value === 'string' && def.values.includes(value)
    case 'string':
      return typeof value === 'string'
  }
}

function describeExpected(def: FieldDef): string {
  switch (def.kind) {
    case 'number':
      return 'a finite number'
    case 'boolean':
      return 'a boolean'
    case 'date':
      return 'an ISO 8601 date string'
    case 'enum':
      return `one of ${def.values.map((v) => JSON.stringify(v)).join(' | ')}`
    case 'string':
      return 'a string'
  }
}

function describeType(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return 'an array'
  if (typeof value === 'string') return JSON.stringify(value)
  return String(value)
}
