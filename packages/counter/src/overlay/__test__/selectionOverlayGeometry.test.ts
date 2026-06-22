import { NodeType, type IDType } from '@latte-js/bean'
import { Camera } from '@latte-js/art'
import { NodeLifecycle, SceneGraph } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { SelectionOverlayGeometryBuilder } from '../selectionOverlayGeometry'

const setBounds = (
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

const createScene = () => {
  const graph = new SceneGraph()
  const rootId: IDType = 'test:page'
  const root = graph.createNode(NodeType.CANVAS, rootId)
  graph.appendChild(0, root)
  const rectA = graph.createNode(NodeType.RECTANGLE, 'test:a')
  graph.appendChild(root, rectA)
  setBounds(graph, rectA, 10, 20, 110, 70)
  return { graph, root, rootId, rectA }
}

const build = (
  graph: SceneGraph,
  selectionIds: readonly IDType[],
  activeRootId: IDType = 'test:page'
) =>
  new SelectionOverlayGeometryBuilder().build({
    sceneGraph: graph,
    selectionIds,
    activeRootId,
    camera: new Camera(200, 200),
  })

describe('SelectionOverlayGeometryBuilder', () => {
  it('returns null for empty selection', () => {
    const { graph, rootId } = createScene()

    expect(build(graph, [], rootId)).toBeNull()
  })

  it('builds bounds and eight handles for a selected node', () => {
    const { graph, rootId } = createScene()

    const geometry = build(graph, ['test:a'], rootId)!

    expect(geometry.group.ids).toEqual(['test:a'])
    expect(geometry.group.worldBounds).toEqual({
      minX: 10,
      minY: 20,
      maxX: 110,
      maxY: 70,
    })
    expect(geometry.group.viewportBounds).toEqual({
      x: 110,
      y: 120,
      width: 100,
      height: 50,
    })
    expect(geometry.handles.map(handle => handle.direction)).toEqual([
      'nw',
      'n',
      'ne',
      'e',
      'se',
      's',
      'sw',
      'w',
    ])
  })

  it('merges multiple selected node bounds', () => {
    const { graph, root, rootId } = createScene()
    const rectB = graph.createNode(NodeType.RECTANGLE, 'test:b')
    graph.appendChild(root, rectB)
    setBounds(graph, rectB, -20, 40, 10, 130)

    const geometry = build(graph, ['test:a', 'test:b'], rootId)!

    expect(geometry.group.ids).toEqual(['test:a', 'test:b'])
    expect(geometry.group.worldBounds).toEqual({
      minX: -20,
      minY: 20,
      maxX: 110,
      maxY: 130,
    })
  })

  it('filters missing, hidden, and inactive nodes', () => {
    const { graph, root, rootId } = createScene()
    const hidden = graph.createNode(NodeType.RECTANGLE, 'test:hidden')
    graph.appendChild(root, hidden)
    setBounds(graph, hidden, -100, -100, -50, -50)
    graph.visible[hidden] = 0

    const inactive = graph.createNode(NodeType.RECTANGLE, 'test:inactive')
    graph.appendChild(root, inactive)
    setBounds(graph, inactive, -200, -200, -150, -150)
    graph.lifecycle[inactive] = NodeLifecycle.Tombstone

    const geometry = build(
      graph,
      ['test:missing', 'test:hidden', 'test:inactive', 'test:a'],
      rootId
    )!

    expect(geometry.group.ids).toEqual(['test:a'])
    expect(geometry.group.worldBounds).toEqual({
      minX: 10,
      minY: 20,
      maxX: 110,
      maxY: 70,
    })
  })

  it('returns null when the selection is outside the viewport', () => {
    const { graph, rectA, rootId } = createScene()
    setBounds(graph, rectA, 1000, 1000, 1100, 1100)

    expect(build(graph, ['test:a'], rootId)).toBeNull()
  })
})
