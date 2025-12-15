import type { SceneGraph } from '../sceneGraph'

export const HierarchyOps = {
  getParent: (graph: SceneGraph, index: number) => {
    return graph.parent[index]
  },

  setParent: (graph: SceneGraph, index: number, parent: number) => {
    graph.parent[index] = parent
  },

  appendChild: (graph: SceneGraph, parentIndex: number, childIndex: number) => {
    graph.appendChild(parentIndex, childIndex)
  },

  remove: (graph: SceneGraph, deleteIndex: number) => {
    graph.deleteNode(deleteIndex)
  },
}
