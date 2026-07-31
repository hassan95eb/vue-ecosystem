import { describe, expect, it } from 'vitest'
import { computeReconnectDelay } from '../src/internal/backoff'

describe('computeReconnectDelay', () => {
  it('rejects attempt < 1', () => {
    expect(() => computeReconnectDelay(0)).toThrow(RangeError)
    expect(() => computeReconnectDelay(-1)).toThrow(RangeError)
    expect(() => computeReconnectDelay(1.5)).toThrow(RangeError)
  })

  it('grows exponentially with the configured multiplier, jitter disabled', () => {
    const options = { baseDelayMs: 100, multiplier: 2, maxDelayMs: 100_000, jitter: 0 }
    expect(computeReconnectDelay(1, options)).toBe(100)
    expect(computeReconnectDelay(2, options)).toBe(200)
    expect(computeReconnectDelay(3, options)).toBe(400)
    expect(computeReconnectDelay(4, options)).toBe(800)
  })

  it('caps growth at maxDelayMs', () => {
    const options = { baseDelayMs: 1_000, multiplier: 2, maxDelayMs: 5_000, jitter: 0 }
    expect(computeReconnectDelay(10, options)).toBe(5_000)
  })

  it('defaults to base=300ms, multiplier=2, cap=10s when unconfigured (jitter disabled for this check)', () => {
    expect(computeReconnectDelay(1, { jitter: 0 })).toBe(300)
    expect(computeReconnectDelay(2, { jitter: 0 })).toBe(600)
    expect(computeReconnectDelay(20, { jitter: 0 })).toBe(10_000)
  })

  it('applies full jitter within [capped * (1 - jitter), capped]', () => {
    const options = { baseDelayMs: 1_000, multiplier: 1, maxDelayMs: 1_000, jitter: 0.5 }
    // capped is always 1_000 here (multiplier 1) so the jitter window is [500, 1000].
    expect(computeReconnectDelay(1, { ...options, random: () => 0 })).toBe(500)
    expect(computeReconnectDelay(1, { ...options, random: () => 1 })).toBe(1_000)
    expect(computeReconnectDelay(1, { ...options, random: () => 0.5 })).toBe(750)
  })

  it('jitter of 1 allows anywhere from 0 up to the capped value', () => {
    const options = { baseDelayMs: 1_000, multiplier: 1, maxDelayMs: 1_000, jitter: 1 }
    expect(computeReconnectDelay(1, { ...options, random: () => 0 })).toBe(0)
    expect(computeReconnectDelay(1, { ...options, random: () => 1 })).toBe(1_000)
  })

  it('uses Math.random by default and always stays within bounds', () => {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const delay = computeReconnectDelay(attempt, { maxDelayMs: 10_000 })
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(delay).toBeLessThanOrEqual(10_000)
    }
  })
})
