import { describe, it, expect } from 'vitest'
import { EcosystemError, isEcosystemError, ECOSYSTEM_ERROR_TAG } from '../src/errors'

class ChildError extends EcosystemError {}

describe('EcosystemError', () => {
  it('carries a default code', () => {
    expect(new EcosystemError('boom').code).toBe('ecosystem/unknown')
  })

  it('carries an explicit code, details and cause', () => {
    const cause = new Error('root cause')
    const err = new EcosystemError('boom', {
      code: 'pkg/bad-input',
      details: { field: 'nationalId' },
      cause,
    })
    expect(err.code).toBe('pkg/bad-input')
    expect(err.details).toEqual({ field: 'nationalId' })
    expect(err.cause).toBe(cause)
  })

  it('reports the concrete subclass name', () => {
    expect(new ChildError('x').name).toBe('ChildError')
    expect(new EcosystemError('x').name).toBe('EcosystemError')
  })

  it('is a real Error', () => {
    const err = new EcosystemError('boom')
    expect(err).toBeInstanceOf(Error)
    expect(err.stack).toBeTypeOf('string')
  })
})

describe('isEcosystemError', () => {
  it('recognises instances and subclasses', () => {
    expect(isEcosystemError(new EcosystemError('x'))).toBe(true)
    expect(isEcosystemError(new ChildError('x'))).toBe(true)
  })

  it('rejects unrelated values', () => {
    expect(isEcosystemError(new Error('x'))).toBe(false)
    expect(isEcosystemError(null)).toBe(false)
    expect(isEcosystemError(undefined)).toBe(false)
    expect(isEcosystemError('EcosystemError')).toBe(false)
    expect(isEcosystemError({ code: 'x' })).toBe(false)
  })

  it('survives the dual package hazard', () => {
    // Simulates a *second*, independently loaded copy of the module: same global
    // symbol registry, different class identity. `instanceof` fails here; the
    // tag check is what must keep working.
    const tag = Symbol.for('vue-ecosystem.error')
    class DuplicateModuleError extends Error {
      [tag] = true
      code = 'other/duplicated'
    }
    const duplicated = new DuplicateModuleError('from another module instance')

    expect(duplicated instanceof EcosystemError).toBe(false)
    expect(isEcosystemError(duplicated)).toBe(true)
    expect(tag).toBe(ECOSYSTEM_ERROR_TAG)
  })

  it('works with the custom matcher', () => {
    expect(new EcosystemError('x', { code: 'pkg/oops' })).toBeEcosystemError('pkg/oops')
    expect(new Error('x')).not.toBeEcosystemError()
  })
})
