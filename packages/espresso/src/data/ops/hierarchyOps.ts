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

  remove: (graph: SceneGraph, index: number) => {
    graph.deleteNode(index)
  },

  detach: (graph: SceneGraph, index: number) => {
    graph.detach(index)
  },

  insertAfter: (
    graph: SceneGraph,
    parent: number,
    child: number,
    refNode: number
  ) => {
    graph.insertAfter(parent, child, refNode)
  },

  getChildren: (graph: SceneGraph, parent: number): number[] => {
    const children: number[] = []
    let curr = graph.firstChild[parent]
    while (curr !== -1) {
      // -1 is NULL_INDEX
      children.push(curr)
      curr = graph.nextSibling[curr]
    }
    return children
  },
}
