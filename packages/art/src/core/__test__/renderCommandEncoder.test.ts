import { BlendModeType, FillType, NodeType } from '@latte-js/bean'
import { NodeCursor, SceneGraph } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { RenderCommandEncoder } from '../renderCommandEncoder'

import {
  BlendMode,
  PaintStyle,
  RenderCommandType,
} from '../../contract/renderBackend'

import type { IPaint } from '@latte-js/bean'
import type { RenderFrame } from '../renderFrameBuilder'

const setRect = (graph: SceneGraph, index: number) => {
  graph.size[index * 2] = 100
  graph.size[index * 2 + 1] = 50
  graph.worldMatrix[index * 6] = 1
  graph.worldMatrix[index * 6 + 1] = 0
  graph.worldMatrix[index * 6 + 2] = 0
  graph.worldMatrix[index * 6 + 3] = 1
  graph.worldMatrix[index * 6 + 4] = 10
  graph.worldMatrix[index * 6 + 5] = 20
}

describe('RenderCommandEncoder', () => {
  it('translates a render frame into backend-neutral commands', () => {
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

    const frame: RenderFrame = {
      activeRootId: 'test:page',
      viewportBounds: { minX: 0, minY: 0, maxX: 200, maxY: 200 },
      reasons: ['test'],
      nodeIndices: [rect],
    }

    const buffer = new RenderCommandEncoder().encode({
      frame,
      sceneGraph: graph,
      cameraMatrix: new Float32Array([1, 0, 0, 1, 0, 0]),
      clearBounds: { x: 0, y: 0, width: 800, height: 600 },
    })

    expect(buffer.pass.clear).toMatchObject({
      width: 800,
      height: 600,
    })
    expect(buffer.commands[0]).toMatchObject({
      type: RenderCommandType.DrawRect,
      width: 100,
      height: 50,
      paint: {
        style: PaintStyle.Fill,
        color: 0xff0000ff,
        blendMode: BlendMode.NORMAL,
      },
    })
  })
})
