import {
  NodeType,
  type ResizeRequest,
  type RotateRequest,
} from '@latte-js/bean'
import {
  DIRTY_LOCAL_MATRIX,
  NodeCursor,
  SceneGraph,
  TransformOps,
} from '@latte-js/espresso'
import { mat2d, vec2 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'

import { DirtyBatch } from '../../pipeline/dirtyBatch'
import { getTransactionManager } from '../../transactions/transactionRegistry'
import { TransactionLabel } from '../../transactions/transactionLabels'
import { MatrixSystem } from '../matrix'
import { TransformSystem } from '../transform'

const flushMatrix = (graph: SceneGraph) => {
  new MatrixSystem(graph).process(
    DirtyBatch.from(new Map([[0, DIRTY_LOCAL_MATRIX]]))
  )
}

const round = (value: number) => {
  const rounded = Number(value.toFixed(4))
  return Object.is(rounded, -0) ? 0 : rounded
}

const expectClosePoint = (
  actual: ArrayLike<number>,
  expected: ArrayLike<number>
) => {
  expect(Array.from(actual).map(round)).toEqual(Array.from(expected).map(round))
}

const getWorldCenter = (graph: SceneGraph, index: number) => {
  const width = TransformOps.getWidth(graph, index)
  const height = TransformOps.getHeight(graph, index)
  return vec2.transformMat2d(
    vec2.create(),
    vec2.fromValues(width / 2, height / 2),
    TransformOps.getMatrix(graph, index, mat2d.create())
  )
}

const getRotationDegrees = (matrix: ArrayLike<number>) =>
  Math.atan2(matrix[1], matrix[0]) * (180 / Math.PI)

describe('TransformSystem property requests', () => {
  it('setSize resizes shapes from their local origin without moving x/y', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    cursor.x = 10
    cursor.y = 20
    cursor.width = 100
    cursor.height = 50

    const system = new TransformSystem(graph)
    system.setSize(['test:rect'], { width: 150 })

    expect(cursor.x).toBe(10)
    expect(cursor.y).toBe(20)
    expect(cursor.width).toBe(150)
    expect(cursor.height).toBe(50)
  })

  it('setSize resizes frames without scaling children', () => {
    const graph = new SceneGraph()
    const frameIndex = graph.createNode(NodeType.FRAME, 'test:frame')
    const childIndex = graph.createNode(NodeType.RECTANGLE, 'test:child')
    graph.appendChild(0, frameIndex)
    graph.appendChild(frameIndex, childIndex)
    const frame = new NodeCursor(graph, frameIndex)
    const child = new NodeCursor(graph, childIndex)
    frame.width = 100
    frame.height = 100
    child.x = 10
    child.y = 20
    child.width = 30
    child.height = 40

    const system = new TransformSystem(graph)
    system.setSize(['test:frame'], { width: 200, height: 50 })

    expect(frame.width).toBe(200)
    expect(frame.height).toBe(50)
    expect(child.x).toBe(10)
    expect(child.y).toBe(20)
    expect(child.width).toBe(30)
    expect(child.height).toBe(40)
  })

  it('setSize scales group descendants from the group bounds', () => {
    const graph = new SceneGraph()
    const groupIndex = graph.createNode(NodeType.GROUP, 'test:group')
    const childIndex = graph.createNode(NodeType.RECTANGLE, 'test:child')
    graph.appendChild(0, groupIndex)
    graph.appendChild(groupIndex, childIndex)
    const group = new NodeCursor(graph, groupIndex)
    const child = new NodeCursor(graph, childIndex)
    group.width = 100
    group.height = 100
    child.x = 10
    child.y = 20
    child.width = 30
    child.height = 40

    const system = new TransformSystem(graph)
    getTransactionManager(graph).begin(TransactionLabel.ResizeLayer, [
      'test:group',
    ])
    system.setSize(['test:group'], { width: 200, height: 50 })

    expect(group.width).toBe(200)
    expect(group.height).toBe(50)
    expect(child.x).toBe(20)
    expect(child.y).toBe(10)
    expect(child.width).toBe(60)
    expect(child.height).toBe(20)
  })

  it('setSize rejects unsupported text targets', () => {
    const graph = new SceneGraph()
    graph.createNode(NodeType.TEXT, 'test:text')
    const system = new TransformSystem(graph)

    expect(() => system.setSize(['test:text'], { width: 100 })).toThrow(
      '[TransformSystem] setSize is unsupported for TEXT'
    )
  })

  it('accepts ResizeRequest absolute-size through the unified resize entrypoint', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    cursor.width = 100
    cursor.height = 50
    const request: ResizeRequest = {
      mode: 'absolute-size',
      width: 140,
      anchor: 'local-origin',
    }

    const system = new TransformSystem(graph)
    system.resize(['test:rect'], request)

    expect(cursor.width).toBe(140)
    expect(cursor.height).toBe(50)
  })

  it('absolute rotation sets each target angle while preserving each center', () => {
    const graph = new SceneGraph()
    const firstIndex = graph.createNode(NodeType.RECTANGLE, 'test:first')
    const secondIndex = graph.createNode(NodeType.RECTANGLE, 'test:second')
    const first = new NodeCursor(graph, firstIndex)
    const second = new NodeCursor(graph, secondIndex)
    first.x = 10
    first.y = 10
    first.width = 20
    first.height = 10
    second.x = 100
    second.y = 30
    second.width = 20
    second.height = 10
    const secondTransform = mat2d.create()
    mat2d.translate(secondTransform, secondTransform, [100, 30])
    mat2d.rotate(secondTransform, secondTransform, Math.PI / 4)
    second.transform = secondTransform
    flushMatrix(graph)
    const firstCenter = getWorldCenter(graph, firstIndex)
    const secondCenter = getWorldCenter(graph, secondIndex)

    const request: RotateRequest = {
      mode: 'absolute',
      angle: 90,
      space: 'containing-parent',
      pivot: 'each-target-center',
    }
    const system = new TransformSystem(graph)
    getTransactionManager(graph).begin(TransactionLabel.TransformLayer, [
      'test:first',
      'test:second',
    ])
    system.rotate(['test:first', 'test:second'], request)

    expect(round(getRotationDegrees(first.transform))).toBe(90)
    expect(round(getRotationDegrees(second.transform))).toBe(90)
    expectClosePoint(getWorldCenter(graph, firstIndex), firstCenter)
    expectClosePoint(getWorldCenter(graph, secondIndex), secondCenter)
  })
})
