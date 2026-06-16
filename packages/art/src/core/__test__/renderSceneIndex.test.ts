import { NodeType } from '@latte-js/bean'
import { SceneGraph } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { RenderSceneIndex } from '../renderSceneIndex'

const setAABB = (
  graph: SceneGraph,
  index: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
) => {
  const ptr = index * 4
  graph.aabb[ptr] = minX
  graph.aabb[ptr + 1] = minY
  graph.aabb[ptr + 2] = maxX
  graph.aabb[ptr + 3] = maxY
}

const createRect = (
  graph: SceneGraph,
  parent: number,
  id: `test:${string}`,
  bounds: [number, number, number, number]
) => {
  const index = graph.createNode(NodeType.RECTANGLE, id)
  graph.appendChild(parent, index)
  setAABB(graph, index, ...bounds)
  return index
}

describe('RenderSceneIndex', () => {
  it('returns viewport hits in paint order within the active root', () => {
    const graph = new SceneGraph()
    const pageA = graph.createNode(NodeType.CANVAS, 'test:page-a')
    const pageB = graph.createNode(NodeType.CANVAS, 'test:page-b')
    graph.appendChild(0, pageA)
    graph.appendChild(0, pageB)
    const rectA = createRect(graph, pageA, 'test:rect-a', [0, 0, 100, 100])
    const rectB = createRect(graph, pageA, 'test:rect-b', [0, 0, 100, 100])
    createRect(graph, pageB, 'test:rect-c', [0, 0, 100, 100])

    const index = new RenderSceneIndex(graph)

    expect(
      index.queryViewport(
        { minX: 0, minY: 0, maxX: 10, maxY: 10 },
        'test:page-a'
      )
    ).toEqual([rectA, rectB])
  })

  it('filters nodes hidden by an ancestor at query time', () => {
    const graph = new SceneGraph()
    const page = graph.createNode(NodeType.CANVAS, 'test:page')
    const group = graph.createNode(NodeType.GROUP, 'test:group')
    graph.appendChild(0, page)
    graph.appendChild(page, group)
    createRect(graph, group, 'test:rect', [0, 0, 100, 100])
    const index = new RenderSceneIndex(graph)

    graph.visible[group] = 0

    expect(
      index.queryViewport({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, 'test:page')
    ).toEqual([])
  })

  it('updates changed node bounds without rebuilding the whole index', () => {
    const graph = new SceneGraph()
    const page = graph.createNode(NodeType.CANVAS, 'test:page')
    graph.appendChild(0, page)
    const rect = createRect(graph, page, 'test:rect', [1000, 1000, 1100, 1100])
    const index = new RenderSceneIndex(graph)

    expect(
      index.queryViewport({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, 'test:page')
    ).toEqual([])

    setAABB(graph, rect, 0, 0, 100, 100)
    index.updateByIds(['test:rect'])

    expect(
      index.queryViewport({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, 'test:page')
    ).toEqual([rect])
  })
})
