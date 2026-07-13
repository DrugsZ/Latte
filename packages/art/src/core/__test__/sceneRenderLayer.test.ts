import { BlendModeType, FillType, NodeType } from '@latte-js/bean'
import { NodeCursor, SceneGraph } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { Camera } from '../camera'
import { SceneRenderLayer } from '../sceneRenderLayer'

import { PaintStyle, RenderCommandType } from '../../contract/renderBackend'

import type { IPaint } from '@latte-js/bean'

const setRect = (graph: SceneGraph, index: number) => {
  graph.size[index * 2] = 100
  graph.size[index * 2 + 1] = 50
  graph.worldMatrix[index * 6] = 1
  graph.worldMatrix[index * 6 + 1] = 0
  graph.worldMatrix[index * 6 + 2] = 0
  graph.worldMatrix[index * 6 + 3] = 1
  graph.worldMatrix[index * 6 + 4] = 10
  graph.worldMatrix[index * 6 + 5] = 20

  graph.aabb[index * 4] = 10
  graph.aabb[index * 4 + 1] = 20
  graph.aabb[index * 4 + 2] = 110
  graph.aabb[index * 4 + 3] = 70
}

describe('SceneRenderLayer', () => {
  it('encodes scene graph nodes into a clear scene command buffer', () => {
    const graph = new SceneGraph()
    const page = graph.createNode(NodeType.CANVAS, 'test:page')
    graph.appendChild(0, page)
    const rect = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    graph.appendChild(page, rect)
    setRect(graph, rect)

    const node = new NodeCursor(graph, rect)
    node.fills = [
      {
        type: FillType.SOLID,
        visible: true,
        opacity: 1,
        blendMode: BlendModeType.NORMAL,
        color: { r: 1, g: 0, b: 0, a: 1 },
      },
    ] satisfies IPaint[]

    const layer = new SceneRenderLayer(graph)
    const buffer = layer.encode({
      sceneGraph: graph,
      camera: new Camera(200, 200),
      backendSize: { width: 800, height: 600, dpr: 1 },
      reasons: ['test'],
      activeRootId: 'test:page',
    })!

    expect(buffer.pass.clear).toMatchObject({ width: 800, height: 600 })
    expect(buffer.commands[0]).toMatchObject({
      type: RenderCommandType.DrawRect,
      width: 100,
      height: 50,
      paint: {
        style: PaintStyle.Fill,
        color: 0xff0000ff,
      },
    })
    expect(layer.lastFrame?.nodeIndices).toEqual([rect])
  })

  it('clears the scene pass when no active root is available', () => {
    const graph = new SceneGraph()
    const layer = new SceneRenderLayer(graph)

    const buffer = layer.encode({
      sceneGraph: graph,
      camera: new Camera(200, 200),
      backendSize: { width: 800, height: 600, dpr: 1 },
      reasons: ['test'],
      activeRootId: null,
    })!

    expect(buffer.pass.clear).toMatchObject({ width: 800, height: 600 })
    expect(buffer.commands).toHaveLength(0)
    expect(layer.lastFrame).toBeNull()
  })
})
