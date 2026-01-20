import type { SceneGraph } from '../data/sceneGraph'
import { NULL_INDEX } from '../data/config'

export function* walkTree(graph: SceneGraph, rootId: number = 0) {
  const stack = [rootId]

  while (stack.length > 0) {
    const curr = stack.pop()!
    yield curr

    let child = graph.firstChild[curr]
    while (child !== NULL_INDEX) {
      stack.push(child)
      child = graph.nextSibling[child]
    }
  }
}
