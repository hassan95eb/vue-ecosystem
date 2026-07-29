# @vue-ecosystem/persian-tools

Persian apps keep re-solving the same problems: converting Jalali dates without
getting leap years wrong, formatting numbers and currency the way Persian readers
expect, validating a national ID / IBAN / card number / mobile number, picking a
date range, and getting RTL inputs to behave. This package solves them once, for
Vue 3.

The calendar and formatting logic are plain functions with no Vue import; the
composables, directives and components are a thin layer on top. Use whichever
half you need.

National-ID, IBAN (Sheba) and card-number checksum logic is delegated to
[`@persian-tools/persian-tools`](https://github.com/persian-tools/persian-tools)
rather than reimplemented — see [Notes on validation](#notes-on-validation) below.

## Install

```bash
pnpm add @vue-ecosystem/persian-tools
```

If you use `PersianDateRangePicker`, `HolidayBadge` or `RelativeDate`, also
import the package's stylesheet once, anywhere in your app's entry point:

```ts
import '@vue-ecosystem/persian-tools/style.css'
```

(The composables, directives and framework-agnostic functions have no CSS and
don't need this.)

## 30-second example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  useJalali,
  usePersianNumber,
  vRtlInput,
  isValidNationalId,
} from '@vue-ecosystem/persian-tools'

const today = ref(new Date())
const { formatted, monthName, isLeapYear } = useJalali(today, { pattern: 'dddd D MMMM YYYY' })
// -> 'چهارشنبه ۱ فروردین ۱۴۰۳'

const { currency } = usePersianNumber(1_250_000)
// -> '۱٬۲۵۰٬۰۰۰ تومان'

const nationalId = ref('')
</script>

<template>
  <p>{{ formatted }} — {{ currency }}</p>
  <input v-rtl-input.numeric.english v-model="nationalId" />
  <p v-if="nationalId">{{ isValidNationalId(nationalId) ? 'معتبر' : 'نامعتبر' }}</p>
</template>
```

Without Vue at all:

```ts
import { gregorianToJalali, formatJalali } from '@vue-ecosystem/persian-tools/jalali'
import { formatCurrency } from '@vue-ecosystem/persian-tools/number'

formatJalali(gregorianToJalali(2024, 3, 20), 'D MMMM YYYY') // '۱ فروردین ۱۴۰۳'
formatCurrency(1_250_000) // '۱٬۲۵۰٬۰۰۰ تومان'
```

## Validating a form field reactively

`useNationalId` / `useIban` / `useCardNumber` are v-model-style wrappers: pass a
`Ref<string>`, get back `isValid` and `normalized`.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useIban, vRtlInput } from '@vue-ecosystem/persian-tools'

const iban = ref('')
const { isValid, normalized } = useIban(iban)
</script>

<template>
  <input v-rtl-input.numeric.english v-model="iban" />
  <p v-if="iban">{{ isValid ? normalized : 'شماره شبا نامعتبر است' }}</p>
</template>
```

## Date-range picker

`PersianDateRangePicker` is a styled shell over the headless `useDateRangePicker`
composable — use the component for a working calendar out of the box, or the
composable directly for a fully custom UI.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { PersianDateRangePicker, type JalaliRange } from '@vue-ecosystem/persian-tools'

const range = ref<JalaliRange>({ start: null, end: null })
</script>

<template>
  <PersianDateRangePicker v-model="range" />
</template>
```

It ships RTL by default (`:rtl="false"` to override), themes entirely through CSS
custom properties (`--vet-drp-*`, see the component's `<style>` block for the
full list) with built-in `prefers-color-scheme: dark` support, and exposes
`header` and `day` scoped slots for swapping the navigation bar or the day cell
while keeping the composable's selection logic. This component is v-model
compatible for the common "bind once, read updates" case; for a fully
controlled range, drive it imperatively via a template ref's exposed `select` /
`clear` methods instead of mutating `modelValue` after mount.

## Holiday badge and relative date

```vue
<script setup lang="ts">
import { HolidayBadge, RelativeDate, useJalali } from '@vue-ecosystem/persian-tools'

const today = useJalali(new Date())
</script>

<template>
  <HolidayBadge :date="today.parts.value" />
  <RelativeDate :date="{ jy: 1403, jm: 1, jd: 1 }" />
</template>
```

`HolidayBadge` renders nothing on a non-holiday date. It only recognises
**fixed-date** Jalali holidays (Nowruz and the solar-calendar anniversaries) —
see the scope note in `internal/jalali-holidays.ts` for why the Hijri-lunar
religious holidays (Eid al-Fitr, Ashura, etc.) are out of scope for this pass.

## What's in it

**Calendar** (`/jalali`) — `gregorianToJalali`, `jalaliToGregorian`, `dateToJalali`,
`jalaliToDate`, `isLeapJalaliYear`, `jalaliMonthLength`, `isValidJalaliDate`,
`addJalaliDays`, `addJalaliMonths`, `jalaliDayOfWeek`, `jalaliDayOfYear`,
`formatJalali`, `parseJalali`, `getJalaliHoliday`, `isJalaliHoliday`,
`FIXED_JALALI_HOLIDAYS`, `formatJalaliRelative`, `jalaliRelativeDayOffset`.

**Numbers** (`/number`) — `toPersianDigits`, `toEnglishDigits`, `formatNumber`,
`parsePersianNumber`, `formatCurrency`, `rialToToman`, `tomanToRial`.

**Validation** (`/validation`) — `isValidNationalId`, `isValidIban`,
`normalizeIban`, `isValidCardNumber`, `normalizeCardNumber`,
`isValidIranianMobile`, `normalizeIranianMobile`.

**Vue composables** — `useJalali`, `usePersianNumber`, `useNationalId`,
`useIban`, `useCardNumber`, `useDateRangePicker`.

**Vue components** — `PersianDateRangePicker`, `HolidayBadge`, `RelativeDate`.

**Directives** — `v-rtl-input`, `v-persian-digits`, `v-half-space`.

## Notes on validation

National-ID, IBAN and card-number checksum logic is delegated to
[`@persian-tools/persian-tools`](https://github.com/persian-tools/persian-tools)
rather than hand-rolled, so this package doesn't carry a second copy of
checksum math to keep in sync. Two things worth knowing:

- `isValidNationalId` enforces an exact 10-digit format itself before
  delegating, because the upstream `verifyIranianNationalId` left-pads short
  input with zeros (`'84575948'` would otherwise silently become
  `'0084575948'` and pass). Province-code prefix checking is available via
  `useNationalId`'s `checkPrefix` option but is off by default.
- `isValidIranianMobile` / `normalizeIranianMobile` are **not** delegated —
  the upstream library has no mobile-number validator, so this pair is
  ecosystem-added.

## Notes on the calendar

Leap years use the 33-year-cycle algorithm, not a `year % 4` rule. The two disagree —
1407 is _not_ a leap year even though it is divisible by 4 — and a naive
implementation is off by a day for the whole of Esfand in those years. Supported
range: Jalali years −61 to 3177. Conversions are checked day-by-day against the
runtime's own `Intl` Persian calendar in the test suite.

`Date` values are read in the host's local time zone. If you need another zone,
convert the `Date` before passing it in rather than relying on a guess.

## Formatting tokens

| Token  | Output    | Token      | Output     |
| ------ | --------- | ---------- | ---------- |
| `YYYY` | `۱۴۰۳`    | `MM` / `M` | `۰۱` / `۱` |
| `YY`   | `۰۳`      | `DD` / `D` | `۰۱` / `۱` |
| `MMMM` | `فروردین` | `dddd`     | `چهارشنبه` |

Text in `[square brackets]` is emitted literally.

## Docs

Full documentation lives in the repo for now; a VitePress site lands with v1.0.
See [ARCHITECTURE.md](../../ARCHITECTURE.md) for the design decisions behind the
pure-core / composable-wrapper split, including the build-tool table this
package now sits in the Vite-library-mode row of (it shipped phase 1 as
composables-only, then gained real `.vue` SFCs).

MIT © vue-ecosystem contributors
