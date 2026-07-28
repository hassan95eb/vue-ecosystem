/**
 * Reads the debug filter from the environment. Internal: not part of the public
 * API surface and excluded from the package exports map.
 */

const NAMESPACE_KEY = 'vue-ecosystem:debug'

function readPattern(): string {
  // Node / bundler-injected env
  const env = typeof process !== 'undefined' ? process.env : undefined
  const fromEnv = env?.[NAMESPACE_KEY] ?? env?.['DEBUG']
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv

  // Browser
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(NAMESPACE_KEY) ?? ''
    }
  } catch {
    // localStorage can throw in sandboxed iframes / privacy modes.
  }
  return ''
}

function matches(pattern: string, namespace: string): boolean {
  if (pattern === '*') return true
  if (pattern.endsWith('*')) return namespace.startsWith(pattern.slice(0, -1))
  return pattern === namespace
}

export function isDebugEnabled(namespace: string): boolean {
  const raw = readPattern()
  if (raw.length === 0) return false
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .some((part) => matches(part, namespace))
}
