import { BlendModeType, FillType, NodeType, type IPaint } from '@latte-js/bean'
import { NodeCursor, SceneGraph } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { SelectionModel } from '../selectionModel'
import { SelectionPropertyModel } from '../selectionPropertyModel'
import { SelectionService } from '../selectionService'

const setWorldMatrix = (
  graph: SceneGraph,
  index: number,
  matrix: readonly [number, number, number, number, number, number]
) => {
  graph.worldMatrix.set(matrix, index * 6)
}

const solidPaint = (r: number): IPaint => ({
  type: FillType.SOLID as const,
  visible: true,
  opacity: 1,
  blendMode: BlendModeType.NORMAL,
  color: { r, g: 0, b: 0, a: 1 },
})

describe('SelectionPropertyModel', () => {
  it('aggregates uniform, mixed, partial, and unavailable property values', () => {
    const graph = new SceneGraph()
    const rectA = graph.createNode(NodeType.RECTANGLE, 'test:a')
    const rectB = graph.createNode(NodeType.RECTANGLE, 'test:b')
    const group = graph.createNode(NodeType.GROUP, 'test:group')
    const text = graph.createNode(NodeType.TEXT, 'test:text')
    const a = new NodeCursor(graph, rectA)
    const b = new NodeCursor(graph, rectB)
    a.opacity = 0.5
    b.opacity = 0.5
    a.fills = [solidPaint(1)]
    b.fills = [solidPaint(0.5)]

    const selection = new SelectionService(graph)
    const model = new SelectionModel(selection, graph)
    const properties = new SelectionPropertyModel(graph)

    selection.select(['test:a', 'test:b'])
    let snapshot = model.getSnapshot(1)
    if (!snapshot) {
      throw new Error('expected a consistent selection snapshot')
    }
    expect(properties.read(snapshot, 'opacity')).toEqual({
      kind: 'uniform',
      value: 0.5,
    })
    expect(properties.read(snapshot, 'fills')).toEqual({ kind: 'mixed' })

    b.opacity = 0.75
    snapshot = model.getSnapshot(2)
    if (!snapshot) {
      throw new Error('expected a consistent selection snapshot')
    }
    expect(properties.read(snapshot, 'opacity')).toEqual({ kind: 'mixed' })

    selection.select(['test:a', 'test:group'])
    snapshot = model.getSnapshot(3)
    if (!snapshot) {
      throw new Error('expected a consistent selection snapshot')
    }
    expect(properties.read(snapshot, 'fills')).toMatchObject({
      kind: 'partial',
      value: [solidPaint(1)],
      supported: 1,
      total: 2,
    })

    selection.select(['test:group', 'test:text'])
    snapshot = model.getSnapshot(4)
    if (!snapshot) {
      throw new Error('expected a consistent selection snapshot')
    }
    expect(properties.read(snapshot, 'cornerRadius')).toEqual({
      kind: 'unavailable',
    })
  })

  it('reads x/y/rotation in the containing-parent coordinate space', () => {
    const graph = new SceneGraph()
    const page = graph.createNode(NodeType.CANVAS, 'test:page')
    const frame = graph.createNode(NodeType.FRAME, 'test:frame')
    const group = graph.createNode(NodeType.GROUP, 'test:group')
    const rect = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    graph.appendChild(0, page)
    graph.appendChild(page, frame)
    graph.appendChild(frame, group)
    graph.appendChild(group, rect)

    const frameCursor = new NodeCursor(graph, frame)
    const groupCursor = new NodeCursor(graph, group)
    const rectCursor = new NodeCursor(graph, rect)
    frameCursor.x = 100
    frameCursor.y = 50
    groupCursor.x = 20
    groupCursor.y = 10
    rectCursor.x = 5
    rectCursor.y = 7
    setWorldMatrix(graph, page, [1, 0, 0, 1, 0, 0])
    setWorldMatrix(graph, frame, [1, 0, 0, 1, 100, 50])
    setWorldMatrix(graph, group, [1, 0, 0, 1, 120, 60])
    setWorldMatrix(graph, rect, [1, 0, 0, 1, 125, 67])

    const selection = new SelectionService(graph)
    const model = new SelectionModel(selection, graph)
    const properties = new SelectionPropertyModel(graph)
    selection.select(['test:rect'])
    const snapshot = model.getSnapshot(1)
    if (!snapshot) {
      throw new Error('expected a consistent selection snapshot')
    }

    expect(properties.read(snapshot, 'x')).toEqual({
      kind: 'uniform',
      value: 25,
    })
    expect(properties.read(snapshot, 'y')).toEqual({
      kind: 'uniform',
      value: 17,
    })
    expect(properties.read(snapshot, 'rotation')).toEqual({
      kind: 'uniform',
      value: 0,
    })
  })

  it('skips uncached property reads while the projection revision is being written', () => {
    const graph = new SceneGraph()
    const rect = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, rect)
    cursor.width = 20
    cursor.height = 10
    setWorldMatrix(graph, rect, [1, 0, 0, 1, 0, 0])

    const selection = new SelectionService(graph)
    const model = new SelectionModel(selection, graph)
    const properties = new SelectionPropertyModel(graph)
    selection.select(['test:rect'])
    const snapshot = model.getSnapshot(1)
    if (!snapshot) {
      throw new Error('expected a consistent selection snapshot')
    }

    graph.beginPublicationWrite()

    expect(properties.read(snapshot, 'height')).toBeNull()
  })
})
