# @vue-ecosystem/query-builder

Composable, type-safe filter and query builder with a serialisable AST.

- **Dependency layer:** 2 — depends on `core` only
- **Build tool:** tsup — logic only, no `.vue` files ([ARCHITECTURE.md](../../ARCHITECTURE.md#build-tool-decision))
- **Version:** `0.1.0` (stays on `0.x` until it meets its v1.0 exit criteria)

## Install

```bash
pnpm add @vue-ecosystem/query-builder
```

`vue` (^3.4) is a peer dependency, and only the composable touches it — the AST,
the builder, `parse()` and `evaluate()` are plain TypeScript.

## What this is

A filter query as **plain JSON**, built from a typed field schema, with a pure
`evaluate(ast, record)` that decides whether one row matches. Three things fall
out of that:

- A query survives `JSON.stringify` → `JSON.parse` untouched, so a saved view, a
  URL fragment or a database column is a viable place to keep one.
- The schema drives the types: field names autocomplete, and asking a number
  field for `contains` is a **compile** error, not a runtime one.
- `smart-table` filters rows by calling `evaluate()` rather than reimplementing
  AST traversal inline — which is why the semantics below are written down and
  tested rather than left to each consumer to rediscover.

## Quickstart

```ts
import { defineSchema, createQuery, evaluate, serialise, parse } from '@vue-ecosystem/query-builder'

const schema = defineSchema({
  title: { kind: 'string' },
  priority: { kind: 'number' },
  active: { kind: 'boolean' },
  createdAt: { kind: 'date' },
  status: { kind: 'enum', values: ['open', 'closed', 'archived'] },
})

// title contains "invoice" AND (priority >= 8 OR status is open)
const ast = createQuery(schema)
  .where('title', 'contains', 'invoice')
  .any((g) => g.where('priority', 'gte', 8).where('status', 'eq', 'open'))
  .build()

evaluate(ast, { title: 'Invoice #4', priority: 2, status: 'open' }) // true

const saved = serialise(ast) // a plain JSON string
parse(saved, schema) // deep-equals `ast`, or throws a QueryBuilderError
```

`defineSchema()` is an identity function with a `const` type parameter. It exists
so `values: ['open', 'closed', 'archived']` does not widen to `string[]` — which
is what lets `.where('status', 'eq', …)` offer the three members as autocomplete
and reject a fourth at compile time.

### The composable

```vue
<script setup lang="ts">
import { defineSchema, useQueryBuilder } from '@vue-ecosystem/query-builder'

const schema = defineSchema({ title: { kind: 'string' }, priority: { kind: 'number' } })

const { ast, serialised, isValid, error, addCondition, addGroup, remove, matches } =
  useQueryBuilder(schema)

addCondition([], 'title', 'contains', 'invoice')
addGroup([], 'or')
addCondition([1], 'priority', 'gte', 8) // into the group just added
</script>
```

Every method takes a **path**: a list of child indexes from the root, so `[]` is
the root group, `[1]` its second child, `[1, 0]` that child's first child. Parse
errors print the same notation (`root.children[1].children[0]`), so an error
message doubles as a pointer at the node a UI needs to highlight.

The composable is deliberately thin — each method is a `ref` assignment around a
pure function. The immutable path edits (`appendNode`, `removeNode`,
`replaceNode`, `setCombinator`, `setNegate`, `updateGroup`) are exported from the
package root too, for consumers with their own state layer.

## Operators by field kind

The type system and `parse()` read the same table, so a rule cannot be true in
one and false in the other.

| Kind      | Operators                                                                                     |
| --------- | --------------------------------------------------------------------------------------------- |
| `string`  | `eq` `neq` `contains` `notContains` `startsWith` `endsWith` `in` `notIn` `isNull` `isNotNull` |
| `number`  | `eq` `neq` `gt` `gte` `lt` `lte` `between` `in` `notIn` `isNull` `isNotNull`                  |
| `boolean` | `eq` `neq` `isNull` `isNotNull`                                                               |
| `date`    | `eq` `neq` `before` `after` `onOrBefore` `onOrAfter` `between` `isNull` `isNotNull`           |
| `enum`    | `eq` `neq` `in` `notIn` `isNull` `isNotNull`                                                  |

`in` / `notIn` take a non-empty array; `between` takes an inclusive `[min, max]`
pair; `isNull` / `isNotNull` take no operand at all — the `value` key is
**absent** from the node, not set to `undefined`, because `JSON.stringify` drops
undefined properties and a node carrying one would not survive its own round
trip.

## `evaluate()` semantics

These are choices, not laws. They are written down here, and pinned by a
table-driven test covering every operator × field kind, precisely so that a
consumer never has to guess and no second implementation ever disagrees.

### `null`, `undefined` and absent keys

`null`, `undefined` and a key that is not on the record at all are one thing:
**missing**. A missing value matches `isNull` and **nothing else** — including
the negative-looking operators. `neq`, `notContains` and `notIn` all return
`false` for a missing value.

The alternative is SQL's three-valued logic, where a comparison against `NULL`
yields `UNKNOWN` and that has to propagate through `and` / `or` / `not`. That
would mean `evaluate()` returns something other than a boolean, and every
consumer inherits the propagation rules. Instead: `neq` means _present and
different_. If you want "missing or different", say so:

```ts
createQuery(schema).any((g) => g.where('title', 'isNull').where('title', 'neq', 'invoice'))
```

Note that `''`, `0` and `false` are **values**, not missing values.

### String comparison is case-insensitive by default

`eq`, `neq`, `contains`, `notContains`, `startsWith`, `endsWith`, `in` and
`notIn` fold case on `string` fields. A "contains" box that misses `Ali` because
the user typed `ali` is a bug report, not a feature. Folding uses
`String.prototype.toLowerCase()`, which is locale-independent, rather than
`toLocaleLowerCase()`, so the same query gives the same answer on every machine.

Pass `{ caseSensitive: true }` to opt out:

```ts
evaluate(ast, record, { caseSensitive: true })
useQueryBuilder(schema, { evaluate: { caseSensitive: true } })
```

**`enum` fields always compare exactly**, regardless of the option. Enum members
are identifiers, not prose — folding them would make `Open` and `open` the same
member, and the schema already says which spelling is real.

### Empty groups match everything

A group with no children returns `true`, for **both** combinators. For `and`
that is the algebraic identity. For `or` it deliberately is not — the identity
would be `false`.

The reason is that the empty group is the initial state of every filter UI, and
a builder that hides every row until you add a rule is broken. "No rules" means
"no filtering", whichever combinator happens to be selected. Negation still
applies: an empty group with `negate: true` matches nothing.

If you need to distinguish "matches everything because it is empty" from
"matches everything because the rules say so", check `ast.children.length`.

### Dates compare as instants

Date operands in the AST are **ISO 8601 strings** — a `Date` would not survive
serialisation, and an epoch number would be indistinguishable from a `number`
field once written to JSON. On the record side, a `Date`, an epoch number and an
ISO string are all accepted and normalised through `Date.parse`.

There is **no truncation to a day**. `eq '2024-01-01'` is midnight UTC and does
not match `2024-01-01T09:00:00Z`. For day-granularity matching, use `between`
over the day's boundaries:

```ts
.where('createdAt', 'between', ['2024-01-01T00:00:00.000Z', '2024-01-01T23:59:59.999Z'])
```

An unparseable date **in the query** is a parse error — the query is authored. An
unparseable date **on a record** is a non-match, and is not `isNull` either: the
field has a value, it is just not a date.

### The remaining rules, briefly

- **`between` is inclusive** at both ends, and tolerant of reversed bounds — a
  two-handle range slider produces `[max, min]` about as often as `[min, max]`.
- **A record value of the wrong runtime type never matches.** A `number` field
  holding `'3'` fails every comparison rather than being coerced.
- **`NaN` is present but unusable**: it matches neither `isNull` nor any
  comparison.
- **`evaluate()` never throws for arbitrary record data.** It throws only when
  the AST itself carries an operator neither the builder nor `parse()` could
  have produced (`query-builder/unsupported-operator`).
- **It mutates neither argument**, and there is no Vue import anywhere beneath
  it.

## Errors

Every failure is a `QueryBuilderError` (extends `EcosystemError` from
`@vue-ecosystem/core`) carrying a namespaced `code` and a `details` object with
the node path.

| Code                                 | When                                                                 |
| ------------------------------------ | -------------------------------------------------------------------- |
| `query-builder/malformed-json`       | `parse()` was handed a string that is not JSON                       |
| `query-builder/malformed-node`       | Wrong `type`, bad `combinator`, missing `negate`, non-array children |
| `query-builder/unknown-field`        | The condition names a field the schema does not declare              |
| `query-builder/unknown-operator`     | The operator is not legal for that field's kind                      |
| `query-builder/invalid-value`        | The operand is the wrong type, shape, or not a declared enum member  |
| `query-builder/invalid-schema`       | `defineSchema()` got an enum with no values                          |
| `query-builder/invalid-path`         | A path edit addressed a node that does not exist                     |
| `query-builder/unsupported-operator` | `evaluate()` met an operator no builder could have produced          |

Check them with `isEcosystemError()` from `@vue-ecosystem/core`, never with
`instanceof` — see [ARCHITECTURE.md](../../ARCHITECTURE.md#dual-package-hazard).

`validate(node, schema)` is the non-throwing counterpart to `parse()`: it returns
the first error, or `null`. A UI that redraws on every keystroke should not be
constructing and catching exceptions to decide whether to grey out a button — the
composable's `isValid` is built on it.

## TODO

- [x] MVP: typed serialisable AST, builder API, `parse` / `serialise`, `evaluate()`, `useQueryBuilder()`
- [ ] REST query-string adapter
- [ ] SQL / SQL-ish emitter
- [ ] UI components and a visual builder
- [ ] Async / remote field and value resolution (autocomplete against an API)
- [ ] Nested-path field access (`user.address.city`)
- [ ] i18n of error messages
- [ ] Docs site

Everything below the MVP line was deliberately left out of this pass, not
forgotten. The adapters and the visual builder are the obvious next step; the
MVP is scoped to what `smart-table` needs to stop blocking, which is
`evaluate()` and a serialisable AST.

## Contributing

Please open an issue before starting work here — the MVP scope for each package is
decided deliberately, not first-come. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
