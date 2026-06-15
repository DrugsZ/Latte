import { walkTreeIndices } from '../data/treeTraversal'

import type { SceneGraph } from '../data/sceneGraph'

export function* walkTree(graph: SceneGraph, rootId: number = 0) {
  yield* walkTreeIndices(graph, rootId, 'walkTree')
}
