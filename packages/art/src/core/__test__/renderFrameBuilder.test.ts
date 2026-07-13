import { NodeType } from '@latte-js/bean'
import { SceneGraph } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { RenderFrameBuilder } from '../renderFrameBuilder'
import { RenderReason } from '../renderScheduler'
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

describe('RenderFrameBuilder', () => {
  it('builds a paint-ordered frame for the active root and viewport', () => {
    const graph = new SceneGraph()
    const page = graph.createNode(NodeType.CANVAS, 'test:page')
    graph.appendChild(0, page)
    const rectA = graph.createNode(NodeType.RECTANGLE, 'test:rect-a')
    const rectB = graph.createNode(NodeType.RECTANGLE, 'test:rect-b')
    graph.appendChild(page, rectA)
    graph.appendChild(page, rectB)
    setAABB(graph, rectA, 0, 0, 100, 100)
    setAABB(graph, rectB, 1000, 1000, 1100, 1100)

    const builder = new RenderFrameBuilder(new RenderSceneIndex(graph))
    const viewportBounds = { minX: 0, minY: 0, maxX: 200, maxY: 200 }
    const frame = builder.build({
      activeRootId: 'test:page',
      viewportBounds,
      reasons: [RenderReason.SceneDirty],
    })

    expect(frame).toEqual({
      activeRootId: 'test:page',
      viewportBounds,
      reasons: [RenderReason.SceneDirty],
      nodeIndices: [rectA],
    })
  })

  it('does not build a frame without an active root', () => {
    const graph = new SceneGraph()
    const builder = new RenderFrameBuilder(new RenderSceneIndex(graph))

    expect(
      builder.build({
        activeRootId: null,
        viewportBounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
        reasons: [RenderReason.Manual],
      })
    ).toBeNull()
  })
})
