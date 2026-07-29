---
'@vue-ecosystem/persian-tools': minor
---

Closed the gap between `persian-tools` and its finalized scope: national-ID, IBAN
and card-number validation now delegate their checksum logic to
`@persian-tools/persian-tools` instead of hand-rolled math, and gained reactive
`useNationalId` / `useIban` / `useCardNumber` wrappers. Added a Jalali date-range
picker (`useDateRangePicker` composable plus the `PersianDateRangePicker` styled
component), `v-persian-digits` and `v-half-space` directives, and `HolidayBadge` /
`RelativeDate` components. The package now ships real `.vue` SFCs, so its build
moved from tsup to Vite library mode (see ARCHITECTURE.md's build-tool table) --
this is a tooling change only, the public `exports` map and ESM+CJS+`.d.ts` output
shape are unchanged. Consumers using `PersianDateRangePicker`, `HolidayBadge` or
`RelativeDate` need to import the package's new stylesheet once:
`import '@vue-ecosystem/persian-tools/style.css'`.
