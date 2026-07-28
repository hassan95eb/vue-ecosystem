import { describe, it, expect, vi, afterEach } from 'vitest'
import { createLogger } from '../src/logger'

const DEBUG_KEY = 'vue-ecosystem:debug'

afterEach(() => {
  delete process.env[DEBUG_KEY]
  vi.restoreAllMocks()
})

describe('createLogger', () => {
  it('is disabled by default and logs nothing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const logger = createLogger('persian-tools')
    logger.log('hello')

    expect(logger.enabled).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })

  it('logs when its exact namespace is enabled', () => {
    process.env[DEBUG_KEY] = 'persian-tools'
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    createLogger('persian-tools').log('hello')
    expect(spy).toHaveBeenCalledWith('[persian-tools]', 'hello')
  })

  it('honours wildcard and comma-separated patterns', () => {
    process.env[DEBUG_KEY] = 'realtime,persian-tools:*'

    expect(createLogger('realtime').enabled).toBe(true)
    expect(createLogger('persian-tools:jalali').enabled).toBe(true)
    expect(createLogger('smart-table').enabled).toBe(false)
  })

  it('enables everything with "*"', () => {
    process.env[DEBUG_KEY] = '*'
    expect(createLogger('anything').enabled).toBe(true)
  })

  it('extends into child namespaces', () => {
    process.env[DEBUG_KEY] = 'persian-tools:*'
    const child = createLogger('persian-tools').extend('jalali')

    expect(child.namespace).toBe('persian-tools:jalali')
    expect(child.enabled).toBe(true)
  })

  it('always reports errors, even when disabled', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    createLogger('persian-tools').error('bad')
    expect(spy).toHaveBeenCalledWith('[persian-tools]', 'bad')
  })
})
