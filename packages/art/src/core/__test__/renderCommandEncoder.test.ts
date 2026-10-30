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
  const opacityScene = () => {
    const graph = new SceneGraph()
    const page = graph.createNode(NodeType.CANVAS, 'test:page')
    const group = graph.createNode(NodeType.GROUP, 'test:group')
    const rect = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const ellipse = graph.createNode(NodeType.ELLIPSE, 'test:ellipse')
    graph.appendChild(0, page)
    graph.appendChild(page, group)
    graph.appendChild(group, rect)
    graph.appendChild(group, ellipse)
    for (const index of [rect, ellipse]) {
      setRect(graph, index)
      new NodeCursor(graph, index).fills = [
        {
          type: FillType.SOLID,
          visible: true,
          opacity: 1,
          blendMode: BlendModeType.NORMAL,
          color: { r: 1, g: 0, b: 0, a: 1 },
        },
      ]
    }
    const encode = () =>
      new RenderCommandEncoder().encode({
        sceneGraph: graph,
        frame: {
          activeRootId: 'test:page',
          viewportBounds: { minX: 0, minY: 0, maxX: 200, maxY: 200 },
          reasons: [],
          nodeIndices: [rect, ellipse],
        },
        cameraMatrix: new Float32Array([1, 0, 0, 1, 0, 0]),
      })
    return { graph, group, rect, ellipse, encode }
  }

  it('keeps sibling shapes in one ancestor opacity scope instead of multiplying each paint', () => {
    const { graph, group, encode } = opacityScene()
    graph.opacity[group] = 0.5
    const commands = encode().commands
    expect(commands.map(command => command.type)).toEqual([
      RenderCommandType.PushLayer,
      RenderCommandType.DrawRect,
      RenderCommandType.DrawEllipse,
      RenderCommandType.Pop,
    ])
    expect(commands[0]).toMatchObject({ alpha: 0.5 })
    expect(commands[1]).toMatchObject({ paint: { color: 0xff0000ff } })
  })

  it('nests a shape opacity scope inside its parent without leaking it to siblings', () => {
    const { graph, group, rect, encode } = opacityScene()
    graph.opacity[group] = 0.5
    graph.opacity[rect] = 0.25
    const commands = encode().commands
    expect(commands.map(command => command.type)).toEqual([
      RenderCommandType.PushLayer,
      RenderCommandType.PushLayer,
      RenderCommandType.DrawRect,
      RenderCommandType.Pop,
      RenderCommandType.DrawEllipse,
      RenderCommandType.Pop,
    ])
    expect(commands[1]).toMatchObject({ alpha: 0.25 })
  })

  it('omits a zero-opacity shape and an entire zero-opacity ancestor subtree', () => {
    const { graph, group, rect, encode } = opacityScene()
    graph.opacity[rect] = 0
    expect(encode().commands.map(command => command.type)).toEqual([
      RenderCommandType.DrawEllipse,
    ])
    graph.opacity[group] = 0
    expect(encode().commands).toHaveLength(0)
  })

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
