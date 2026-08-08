---
'@vue-ecosystem/query-builder': minor
---

Shipped the package's MVP: a filter query as a typed, serialisable AST, plus the
pure `evaluate(ast, record)` that `smart-table` has been blocked on.

The AST is plain JSON at every moment — no class instances, no functions, no
`Date`, and the unary operators (`isNull` / `isNotNull`) omit the `value` key
entirely rather than setting it to `undefined`, because `JSON.stringify` drops
undefined properties and a node carrying one would not survive its own round
trip. A property test generates 400 seeded queries and asserts each one
deep-equals itself after `serialise` → `parse`, so a saved view, a URL fragment
or a database column is a viable place to keep a query.

Field kinds (`string`, `number`, `boolean`, `date`, `enum`) decide which
operators are legal, and they decide it in the type system: `.where('age',
'contains', …)` fails to compile, it does not merely throw. One operator table
drives both the type-level rules and the runtime check in `parse()`, so a query
assembled in TypeScript and a query loaded from JSON are held to the same rule.
`parse()` reports unknown fields, illegal operators, wrong value types and
malformed groups as distinct `QueryBuilderError` codes, each naming the offending
node's path (`root.children[1].children[0]`).

`evaluate()` is pure, framework-agnostic and exported from the package root
specifically so nothing downstream reimplements AST traversal inline. Its
semantics are documented in the README and pinned by a table-driven suite over
every operator × field kind: `null`, `undefined` and an absent key are one thing
and match `isNull` and nothing else — including `neq` and `notIn`; strings fold
case by default while enum members never do; an empty group matches everything
for both combinators, because the empty group is the initial state of every
filter UI; dates are ISO strings compared as absolute instants, with no
truncation to a day; `between` is inclusive.

`useQueryBuilder()` is a thin reactive wrapper — a `ref` assignment around a pure
function per method, with `isValid`, the first validation `error`, and the
serialised form derived from it. The path-addressed edits it is built on are
immutable and exported too, for consumers with their own state layer.

Deliberately out of scope for this pass, and tracked in the package README: the
REST query-string adapter, a SQL-ish emitter, any UI or visual builder, async and
remote field/value resolution, nested-path field access (`user.address.city`),
i18n of error messages, and a docs site. The package moves from a private
skeleton to a real, publishable `0.1.0`.
