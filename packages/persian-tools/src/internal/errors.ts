import { EcosystemError } from '@vue-ecosystem/core'

export class PersianToolsError extends EcosystemError {}

export function invalidJalaliDate(jy: number, jm: number, jd: number): PersianToolsError {
  return new PersianToolsError(`Invalid Jalali date: ${jy}/${jm}/${jd}`, {
    code: 'persian-tools/invalid-jalali-date',
    details: { jy, jm, jd },
  })
}

export function unsupportedJalaliYear(jy: number): PersianToolsError {
  return new PersianToolsError(`Jalali year ${jy} is outside the supported range (-61 .. 3177).`, {
    code: 'persian-tools/year-out-of-range',
    details: { jy },
  })
}
