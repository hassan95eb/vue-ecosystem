/**
 * Immutable, path-addressed edits to an AST.
 *
 * This is the whole of `useQueryBuilder`'s behaviour, minus the ref. Keeping it
 * here rather than inside the composable means the interesting cases -- editing
 * a node three levels down, removing the last child of a nested group, negating
 * the root -- are tested as plain function calls, with no component to mount
 * and no `nextTick` to await.
 *
 * ## Paths
 *
 * A path is a list of child indexes from the root: `[]` is the root group,
 * `[1]` is its second child, `[1, 0]` is that child's first child. It is the
 * same notation the parse errors print, so an error message doubles as a
 * pointer at the node a UI needs to highlight.
 *
 * ## Immutability
 *
 * Every function returns a new tree with structural sharing: only the nodes on
 * the path from the root to the edit are rebuilt. A Vue `ref` therefore sees a
 * genuinely new object and triggers, and holding on to a previous AST (undo
 * history, for instance) is safe by construction.
 */

import { isGroup, type Combinator, type Group, type QueryAst, type QueryNode } from './ast'
import { invalidPath, type NodePath } from './errors'

/** The node at `path`, or `null` if the path does not address one. */
export function findNode(ast: QueryAst, path: NodePath): QueryNode | null {
  let current: QueryNode = ast

  for (const index of path) {
    if (!isGroup(current)) return null
    const next: QueryNode | undefined = current.children[index]
    if (next === undefined) return null
    current = next
  }

  return current
}

/** The group at `path`, or `null` if `path` addresses a condition or nothing. */
export function findGroup(ast: QueryAst, path: NodePath): Group | null {
  const node = findNode(ast, path)
  return node !== null && isGroup(node) ? node : null
}

/**
 * Append `node` to the children of the group at `path`.
 *
 * @throws {@link QueryBuilderError} `query-builder/invalid-path` when `path`
 * addresses nothing, or addresses a condition (conditions have no children).
 */
export function appendNode(ast: QueryAst, path: NodePath, node: QueryNode): QueryAst {
  return updateGroup(ast, path, (group) => ({ ...group, children: [...group.children, node] }))
}

/**
 * Remove the node at `path`.
 *
 * @throws {@link QueryBuilderError} `query-builder/invalid-path` when `path` is
 * empty (the root is not removable -- clear its children instead) or addresses
 * nothing.
 */
export function removeNode(ast: QueryAst, path: NodePath): QueryAst {
  if (path.length === 0) {
    throw invalidPath(path, 'the root group cannot be removed; remove its children instead')
  }

  const parentPath = path.slice(0, -1)
  const index = path[path.length - 1] as number

  return updateGroup(ast, parentPath, (group) => {
    if (group.children[index] === undefined) {
      throw invalidPath(path, `its parent has ${group.children.length} children`)
    }
    return { ...group, children: group.children.filter((_, i) => i !== index) }
  })
}

/**
 * Replace the node at `path` wholesale.
 *
 * @throws {@link QueryBuilderError} `query-builder/invalid-path`
 */
export function replaceNode(ast: QueryAst, path: NodePath, node: QueryNode): QueryAst {
  if (path.length === 0) {
    if (!isGroup(node)) throw invalidPath(path, 'the root of a query must be a group')
    return node
  }

  const parentPath = path.slice(0, -1)
  const index = path[path.length - 1] as number

  return updateGroup(ast, parentPath, (group) => {
    if (group.children[index] === undefined) {
      throw invalidPath(path, `its parent has ${group.children.length} children`)
    }
    return { ...group, children: group.children.map((child, i) => (i === index ? node : child)) }
  })
}

/**
 * Apply `patch` to the group at `path`.
 *
 * @throws {@link QueryBuilderError} `query-builder/invalid-path`
 */
export function updateGroup(
  ast: QueryAst,
  path: NodePath,
  patch: (group: Group) => Group,
): QueryAst {
  return rebuild(ast, path, 0, patch) as QueryAst
}

export function setCombinator(ast: QueryAst, path: NodePath, combinator: Combinator): QueryAst {
  return updateGroup(ast, path, (group) => ({ ...group, combinator }))
}

export function setNegate(ast: QueryAst, path: NodePath, negate: boolean): QueryAst {
  return updateGroup(ast, path, (group) => ({ ...group, negate }))
}

function rebuild(
  node: QueryNode,
  path: NodePath,
  depth: number,
  patch: (group: Group) => Group,
): QueryNode {
  if (!isGroup(node)) {
    throw invalidPath(path.slice(0, depth), 'a condition has no children to descend into')
  }

  if (depth === path.length) return patch(node)

  const index = path[depth] as number
  const child = node.children[index]
  if (child === undefined) {
    throw invalidPath(path.slice(0, depth + 1), `its parent has ${node.children.length} children`)
  }

  return {
    ...node,
    children: node.children.map((c, i) => (i === index ? rebuild(c, path, depth + 1, patch) : c)),
  }
}
