import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, h, nextTick } from 'vue'
import { createQuery, useQueryBuilder, type QueryAst } from '../src'
import { schema, type TestSchema } from './fixtures'

type Api = ReturnType<typeof useQueryBuilder<TestSchema>>

/**
 * Mounts a component around the composable and hands back the live API plus a
 * render counter.
 *
 * The counter is the point of testing this in a component at all: asserting
 * that `ast.value` changed proves the function ran, not that Vue noticed. Every
 * mutation here has to actually invalidate a render.
 */
function mountHarness(options?: Parameters<typeof useQueryBuilder>[1]): {
  api: Api
  renders: () => number
  unmount: () => void
} {
  let api!: Api
  let renders = 0

  const Component = defineComponent({
    setup() {
      api = useQueryBuilder(schema, options)
      const summary = computed(() => api.serialised.value)
      return () => {
        renders += 1
        return h('pre', summary.value)
      }
    },
  })

  const wrapper = mount(Component)
  return { api, renders: () => renders, unmount: () => wrapper.unmount() }
}

describe('useQueryBuilder: initial state', () => {
  it('starts with an empty and-group', () => {
    const { api, unmount } = mountHarness()

    expect(api.ast.value).toStrictEqual({
      type: 'group',
      combinator: 'and',
      negate: false,
      children: [],
    })
    expect(api.isValid.value).toBe(true)
    expect(api.error.value).toBeNull()

    unmount()
  })

  it('honours the root combinator option', () => {
    const { api, unmount } = mountHarness({ combinator: 'or' })
    expect(api.ast.value.combinator).toBe('or')
    unmount()
  })

  it('hydrates from an AST', () => {
    const initial = createQuery(schema).where('title', 'eq', 'a').build()
    const { api, unmount } = mountHarness({ initial })

    expect(api.ast.value).toStrictEqual(initial)
    unmount()
  })

  it('hydrates from a serialised string', () => {
    const initial = createQuery(schema).where('priority', 'gte', 3).build()
    const { api, unmount } = mountHarness({ initial: JSON.stringify(initial) })

    expect(api.ast.value).toStrictEqual(initial)
    unmount()
  })

  it('falls back to an empty query and warns when `initial` is invalid', () => {
    // A saved view written against an older schema must not take the whole
    // component down during setup().
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { api, unmount } = mountHarness({ initial: '{ not json' })

    expect(api.ast.value.children).toStrictEqual([])
    expect(api.isValid.value).toBe(true)

    warn.mockRestore()
    unmount()
  })
})

describe('useQueryBuilder: reactivity', () => {
  it('re-renders when a condition is added', async () => {
    const { api, renders, unmount } = mountHarness()
    const before = renders()

    api.addCondition([], 'title', 'contains', 'invoice')
    await nextTick()

    expect(renders()).toBe(before + 1)
    expect(api.ast.value.children).toHaveLength(1)
    unmount()
  })

  it('keeps `serialised` in step with the AST', async () => {
    const { api, unmount } = mountHarness()

    api.addCondition([], 'priority', 'gte', 3)
    await nextTick()

    expect(JSON.parse(api.serialised.value)).toStrictEqual(api.ast.value)
    expect(api.serialised.value).toContain('"gte"')
    unmount()
  })

  it('adds and fills nested groups by path', async () => {
    const { api, unmount } = mountHarness()

    api.addCondition([], 'title', 'contains', 'q')
    api.addGroup([], 'or')
    api.addCondition([1], 'priority', 'gt', 8)
    api.addCondition([1], 'status', 'eq', 'open')
    await nextTick()

    expect(api.matches({ title: 'q1', priority: 9, status: 'closed' })).toBe(true)
    expect(api.matches({ title: 'q1', priority: 1, status: 'open' })).toBe(true)
    expect(api.matches({ title: 'q1', priority: 1, status: 'closed' })).toBe(false)
    unmount()
  })

  it('updates a condition in place', async () => {
    const { api, unmount } = mountHarness()

    api.addCondition([], 'priority', 'gte', 3)
    api.updateCondition([0], 'priority', 'lt', 3)
    await nextTick()

    expect(api.ast.value.children[0]).toMatchObject({ operator: 'lt', value: 3 })
    unmount()
  })

  it('replaces a node wholesale', async () => {
    const { api, unmount } = mountHarness()

    api.addCondition([], 'priority', 'gte', 3)
    api.updateNode([0], { type: 'group', combinator: 'and', negate: false, children: [] })
    await nextTick()

    expect(api.ast.value.children[0]).toMatchObject({ type: 'group' })
    unmount()
  })

  it('removes a node', async () => {
    const { api, unmount } = mountHarness()

    api.addCondition([], 'title', 'eq', 'a')
    api.addCondition([], 'title', 'eq', 'b')
    api.remove([0])
    await nextTick()

    expect(api.ast.value.children).toHaveLength(1)
    expect(api.ast.value.children[0]).toMatchObject({ value: 'b' })
    unmount()
  })

  it('flips combinator and negation reactively', async () => {
    const { api, renders, unmount } = mountHarness()
    const before = renders()

    api.setCombinator([], 'or')
    api.setNegate([], true)
    await nextTick()

    expect(api.ast.value).toMatchObject({ combinator: 'or', negate: true })
    expect(renders()).toBeGreaterThan(before)
    unmount()
  })

  it('resets to the original root combinator', async () => {
    const { api, unmount } = mountHarness({ combinator: 'or' })

    api.addCondition([], 'title', 'eq', 'a')
    api.setNegate([], true)
    api.reset()
    await nextTick()

    expect(api.ast.value).toStrictEqual({
      type: 'group',
      combinator: 'or',
      negate: false,
      children: [],
    })
    unmount()
  })
})

describe('useQueryBuilder: validity', () => {
  it('reports a hand-edited AST as invalid, with the reason', async () => {
    const { api, unmount } = mountHarness()

    // The realistic path to an invalid AST: a UI bound `v-model` straight at
    // `ast` and let a user pick a field the schema no longer has.
    api.ast.value = {
      type: 'group',
      combinator: 'and',
      negate: false,
      children: [{ type: 'condition', field: 'nope', kind: 'string', operator: 'eq', value: 'x' }],
    } as unknown as QueryAst
    await nextTick()

    expect(api.isValid.value).toBe(false)
    expect(api.error.value).toBeEcosystemError('query-builder/unknown-field')
    unmount()
  })

  it('recovers when the offending node is removed', async () => {
    const { api, unmount } = mountHarness()

    api.ast.value = {
      type: 'group',
      combinator: 'and',
      negate: false,
      children: [{ type: 'condition', field: 'nope', kind: 'string', operator: 'eq', value: 'x' }],
    } as unknown as QueryAst
    await nextTick()
    expect(api.isValid.value).toBe(false)

    api.remove([0])
    await nextTick()

    expect(api.isValid.value).toBe(true)
    expect(api.error.value).toBeNull()
    unmount()
  })
})

describe('useQueryBuilder: errors', () => {
  it('throws from addCondition for an unknown field', () => {
    const { api, unmount } = mountHarness()

    let thrown: unknown = '<did not throw>'
    try {
      ;(api.addCondition as unknown as (p: number[], f: string, o: string, v: unknown) => void)(
        [],
        'nope',
        'eq',
        'x',
      )
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeEcosystemError('query-builder/unknown-field')
    unmount()
  })

  it('throws from remove for a path that does not exist', () => {
    const { api, unmount } = mountHarness()

    let thrown: unknown = '<did not throw>'
    try {
      api.remove([3])
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeEcosystemError('query-builder/invalid-path')
    unmount()
  })
})

describe('useQueryBuilder: matches', () => {
  it('passes evaluate options through', async () => {
    const { api, unmount } = mountHarness({ evaluate: { caseSensitive: true } })

    api.addCondition([], 'title', 'contains', 'INV')
    await nextTick()

    expect(api.matches({ title: 'invoice' })).toBe(false)
    unmount()
  })

  it('matches everything while the query is empty', () => {
    const { api, unmount } = mountHarness()
    expect(api.matches({ title: 'anything' })).toBe(true)
    unmount()
  })
})
