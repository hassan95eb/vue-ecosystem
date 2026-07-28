# @vue-ecosystem/core

Every package in this ecosystem needs the same three things — a common error type, a
way to turn on debug output without shipping it to production, and a shared set of
composable-facing types. Duplicating those across nine packages is how ecosystems
drift apart, so they live here instead.

`core` has no domain logic and no runtime dependencies. Vue is a peer dependency,
used for types only.

## Install

```bash
pnpm add @vue-ecosystem/core
```

## 30-second example

```ts
import { EcosystemError, isEcosystemError, createLogger } from '@vue-ecosystem/core'

const log = createLogger('my-package')
log.log('only printed when debug is on')

class InvalidDateError extends EcosystemError {}

try {
  throw new InvalidDateError('month out of range', {
    code: 'persian-tools/invalid-jalali-date',
    details: { month: 13 },
  })
} catch (err) {
  // Note: isEcosystemError(), not `instanceof`. See below.
  if (isEcosystemError(err)) console.error(err.code, err.details)
}
```

Turn debug output on:

```bash
# node
DEBUG='my-package:*' node app.js
```

```js
// browser
localStorage.setItem('vue-ecosystem:debug', 'my-package:*')
```

## Always use `isEcosystemError()`, never `instanceof`

The package ships dual ESM + CJS output. If a consuming project resolves `core`
through two different paths, two separate copies of the class exist and
`instanceof` returns `false` for errors that genuinely are ecosystem errors.
`isEcosystemError()` checks a `Symbol.for()` tag from the global symbol registry,
which stays identical across duplicated module instances.

Full rationale: [ARCHITECTURE.md](../../ARCHITECTURE.md#dual-package-hazard).

## Test setup

```ts
// vitest setupFiles
import '@vue-ecosystem/core/test-setup'

expect(err).toBeEcosystemError('persian-tools/invalid-jalali-date')
```

## Docs

Full documentation: see [ARCHITECTURE.md](../../ARCHITECTURE.md). A VitePress docs
site lands with v1.0.

MIT © vue-ecosystem contributors
