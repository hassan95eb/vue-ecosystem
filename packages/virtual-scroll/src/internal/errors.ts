import { EcosystemError } from '@vue-ecosystem/core'

export class VirtualScrollError extends EcosystemError {}

export function invalidItemHeight(itemHeight: number): VirtualScrollError {
  return new VirtualScrollError(
    `itemHeight must be a finite number greater than 0, received ${itemHeight}.`,
    { code: 'virtual-scroll/invalid-item-height', details: { itemHeight } },
  )
}

export function invalidOverscan(overscan: number): VirtualScrollError {
  return new VirtualScrollError(`overscan must be a non-negative integer, received ${overscan}.`, {
    code: 'virtual-scroll/invalid-overscan',
    details: { overscan },
  })
}
