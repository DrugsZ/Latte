import { MAX_NODES, NULL_INDEX } from './config'

import type { SceneGraph } from './sceneGraph'

export function assertTreeNodeIndex(
  graph: SceneGraph,
  index: number,
  source = 'tree traversal'
) {
  graph.assertNodeIndexAlive(index, source)
}

export function* iterateChildIndices(
  graph: SceneGraph,
  parent: number,
  source = `children of ${parent}`
) {
  assertTreeNodeIndex(graph, parent, source)

  const visited = new Set<number>()
  let child = graph.firstChild[parent]
  let steps = 0

  while (child !== NULL_INDEX) {
    assertTreeNodeIndex(graph, child, `${source} child`)

    if (visited.has(child) || steps >= MAX_NODES) {
      throw new Error(`Tree cycle detected at node ${child}`)
    }

    visited.add(child)
    yield child

    child = graph.nextSibling[child]
    steps++
  }
}

export function* walkTreeIndices(
  graph: SceneGraph,
  root: number = 0,
  source = 'walkTree'
) {
  const stack = [root]
  const visited = new Set<number>()

  while (stack.length > 0) {
    const current = stack.pop()!

    assertTreeNodeIndex(graph, current, source)
    if (visited.has(current) || visited.size >= MAX_NODES) {
      throw new Error(`Tree cycle detected at node ${current}`)
    }

    visited.add(current)
    yield current

    for (const child of iterateChildIndices(
      graph,
      current,
      `${source} child`
    )) {
      stack.push(child)
    }
  }
}

export function collectSubtreeIndices(graph: SceneGraph, root: number) {
  return Array.from(walkTreeIndices(graph, root, 'collectSubtree'))
}
