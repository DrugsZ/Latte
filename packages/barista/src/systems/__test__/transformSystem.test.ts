import { NodeType } from '@latte-js/bean'
import {
  DIRTY_LOCAL_MATRIX,
  NodeCursor,
  SceneGraph,
  TransformOps,
} from '@latte-js/espresso'
import { mat2d, vec2 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'

import {
  getHistoryManager,
  getTransactionManager,
} from '../../transactions/transactionRegistry'
import { DirtyBatch } from '../../pipeline/dirtyBatch'
import { MatrixSystem } from '../matrix'
import { TransformSystem } from '../transform'

const flushMatrix = (graph: SceneGraph) => {
  new MatrixSystem(graph).process(
    DirtyBatch.from(new Map([[0, DIRTY_LOCAL_MATRIX]]))
  )
}

const expectCloseMatrix = (actual: ArrayLike<number>, expected: number[]) => {
  expect(Array.from(actual).map(value => Number(value.toFixed(4)))).toEqual(
    expected.map(value => Number(value.toFixed(4)))
  )
}

const expectClosePoint = (
  actual: ArrayLike<number>,
  expected: ArrayLike<number>
) => {
  expect(Array.from(actual).map(value => Number(value.toFixed(4)))).toEqual(
    Array.from(expected).map(value => Number(value.toFixed(4)))
  )
}

const transformCorners = (
  matrix: mat2d,
  width: number,
  height: number
): vec2[] => {
  return [
    vec2.fromValues(0, 0),
    vec2.fromValues(width, 0),
    vec2.fromValues(width, height),
    vec2.fromValues(0, height),
  ].map(point => vec2.transformMat2d(vec2.create(), point, matrix))
}

const multiply = (...matrices: mat2d[]) => {
  const out = mat2d.create()
  for (const matrix of matrices) {
    mat2d.multiply(out, out, matrix)
  }
  return out
}

describe('TransformSystem', () => {
  it('moveBy uses the session snapshot x/y as its base', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    cursor.x = 10
    cursor.y = 20

    const system = new TransformSystem(graph)
    const transactions = getTransactionManager(graph)
    transactions.begin('Move Layer', ['test:rect'])

    system.moveBy(['test:rect'], [5, -2])
    expect(cursor.x).toBe(15)
    expect(cursor.y).toBe(18)

    system.moveBy(['test:rect'], [7, 3])
    expect(cursor.x).toBe(17)
    expect(cursor.y).toBe(23)
  })

  it('transaction abort restores the transform snapshot', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    cursor.x = 10
    cursor.y = 20
    cursor.width = 100
    cursor.height = 50

    const system = new TransformSystem(graph)
    const transactions = getTransactionManager(graph)
    transactions.begin('Move Layer', ['test:rect'])
    system.moveBy(['test:rect'], [40, 30])
    cursor.width = 200

    transactions.abort()

    expect(cursor.x).toBe(10)
    expect(cursor.y).toBe(20)
    expect(cursor.width).toBe(100)
    expect(cursor.height).toBe(50)
  })

  it('transaction commit preserves the final transform', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    cursor.x = 10
    cursor.y = 20

    const system = new TransformSystem(graph)
    const transactions = getTransactionManager(graph)
    const history = getHistoryManager(graph)
    transactions.begin('Move Layer', ['test:rect'])
    system.moveBy(['test:rect'], [40, 30])
    history.push(transactions.commit())

    expect(cursor.x).toBe(50)
    expect(cursor.y).toBe(50)
  })

  it('undo and redo committed transform sessions', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    cursor.x = 10
    cursor.y = 20

    const system = new TransformSystem(graph)
    const transactions = getTransactionManager(graph)
    const history = getHistoryManager(graph)
    transactions.begin('Move Layer', ['test:rect'])
    system.moveBy(['test:rect'], [40, 30])
    history.push(transactions.commit())

    expect(history.canUndo).toBe(true)
    expect(history.undo()).toBe(true)
    expect(cursor.x).toBe(10)
    expect(cursor.y).toBe(20)

    expect(history.canRedo).toBe(true)
    expect(history.redo()).toBe(true)
    expect(cursor.x).toBe(50)
    expect(cursor.y).toBe(50)
  })

  it('moveTo resolves a target world position back into rotated parent local coordinates', () => {
    const graph = new SceneGraph()
    const parentIndex = graph.createNode(NodeType.GROUP, 'test:parent')
    const childIndex = graph.createNode(NodeType.RECTANGLE, 'test:child')
    graph.appendChild(0, parentIndex)
    graph.appendChild(parentIndex, childIndex)

    const parent = new NodeCursor(graph, parentIndex)
    const parentMatrix = mat2d.create()
    mat2d.translate(parentMatrix, parentMatrix, [100, 50])
    mat2d.rotate(parentMatrix, parentMatrix, Math.PI / 2)
    parent.transform = parentMatrix

    const child = new NodeCursor(graph, childIndex)
    child.x = 20
    child.y = 0
    flushMatrix(graph)

    const system = new TransformSystem(graph)
    const transactions = getTransactionManager(graph)
    transactions.begin('Move Layer', ['test:child'])
    system.moveTo(['test:child'], [100, 90])

    expect(Math.round(child.x)).toBe(40)
    expect(Math.round(child.y)).toBe(0)
  })

  it('moveBy uses absolute session deltas in world space under rotated parents', () => {
    const graph = new SceneGraph()
    const parentIndex = graph.createNode(NodeType.GROUP, 'test:parent')
    const childIndex = graph.createNode(NodeType.RECTANGLE, 'test:child')
    graph.appendChild(0, parentIndex)
    graph.appendChild(parentIndex, childIndex)

    const parent = new NodeCursor(graph, parentIndex)
    const parentMatrix = mat2d.create()
    mat2d.translate(parentMatrix, parentMatrix, [100, 50])
    mat2d.rotate(parentMatrix, parentMatrix, Math.PI / 2)
    parent.transform = parentMatrix

    const child = new NodeCursor(graph, childIndex)
    child.x = 20
    child.y = 0

    const system = new TransformSystem(graph)
    const transactions = getTransactionManager(graph)
    transactions.begin('Move Layer', ['test:child'])

    system.moveBy(['test:child'], [0, 20])
    expect(Math.round(child.x)).toBe(40)
    expect(Math.round(child.y)).toBe(0)

    system.moveBy(['test:child'], [0, 30])
    expect(Math.round(child.x)).toBe(50)
    expect(Math.round(child.y)).toBe(0)
  })

  it('transformAround applies a world-space rotation around the provided pivot', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    cursor.x = 10
    cursor.y = 0
    flushMatrix(graph)

    const rotation = mat2d.create()
    mat2d.rotate(rotation, rotation, Math.PI / 2)

    const system = new TransformSystem(graph)
    const transactions = getTransactionManager(graph)
    transactions.begin('Rotate Layer', ['test:rect'])
    system.transformAround(['test:rect'], rotation, [0, 0])

    expectCloseMatrix(cursor.transform, [0, 1, -1, 0, 0, 10])
  })

  it('transformAround treats session payloads as target transforms from the initial snapshot', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    cursor.x = 10
    cursor.y = 0

    const rotation45 = mat2d.create()
    mat2d.rotate(rotation45, rotation45, Math.PI / 4)
    const rotation90 = mat2d.create()
    mat2d.rotate(rotation90, rotation90, Math.PI / 2)

    const system = new TransformSystem(graph)
    const transactions = getTransactionManager(graph)
    transactions.begin('Rotate Layer', ['test:rect'])
    system.transformAround(['test:rect'], rotation45, [0, 0])
    system.transformAround(['test:rect'], rotation90, [0, 0])

    expectCloseMatrix(cursor.transform, [0, 1, -1, 0, 0, 10])
  })

  it('resize scales descendants in the resized node world basis and compensates their local matrix', () => {
    const graph = new SceneGraph()
    const rootIndex = graph.createNode(NodeType.GROUP, 'test:group')
    const childIndex = graph.createNode(NodeType.RECTANGLE, 'test:child')
    graph.appendChild(0, rootIndex)
    graph.appendChild(rootIndex, childIndex)

    const root = new NodeCursor(graph, rootIndex)
    root.width = 100
    root.height = 100

    const child = new NodeCursor(graph, childIndex)
    child.x = 10
    child.y = 20
    child.width = 10
    child.height = 10
    flushMatrix(graph)

    const system = new TransformSystem(graph)
    const transactions = getTransactionManager(graph)
    transactions.begin('Resize Group', ['test:group'])
    system.resize(['test:group'], 200, 50)

    expect(root.width).toBe(200)
    expect(root.height).toBe(50)
    expect(child.x).toBe(20)
    expect(child.y).toBe(10)
    expect(child.width).toBe(20)
    expect(child.height).toBe(5)
    expectCloseMatrix(child.transform, [1, 0, 0, 1, 20, 10])
  })

  it('resize uses the selected node basis under rotation without requiring cached world matrices', () => {
    const graph = new SceneGraph()
    const rootIndex = graph.createNode(NodeType.GROUP, 'test:group')
    const childIndex = graph.createNode(NodeType.RECTANGLE, 'test:child')
    graph.appendChild(0, rootIndex)
    graph.appendChild(rootIndex, childIndex)

    const root = new NodeCursor(graph, rootIndex)
    root.width = 100
    root.height = 100
    const rootMatrix = mat2d.create()
    mat2d.translate(rootMatrix, rootMatrix, [100, 50])
    mat2d.rotate(rootMatrix, rootMatrix, Math.PI / 2)
    root.transform = rootMatrix

    const child = new NodeCursor(graph, childIndex)
    child.x = 10
    child.y = 20
    child.width = 10
    child.height = 10

    const system = new TransformSystem(graph)
    const transactions = getTransactionManager(graph)
    transactions.begin('Resize Group', ['test:group'])
    system.resize(['test:group'], 200, 50)

    expect(root.width).toBe(200)
    expect(root.height).toBe(50)
    expect(child.x).toBe(20)
    expect(child.y).toBe(10)
    expect(child.width).toBe(20)
    expect(child.height).toBe(5)
    expectCloseMatrix(child.transform, [1, 0, 0, 1, 20, 10])
  })

  it('resize targets the initial snapshot size instead of accumulating intermediate scales', () => {
    const graph = new SceneGraph()
    const rootIndex = graph.createNode(NodeType.GROUP, 'test:group')
    const childIndex = graph.createNode(NodeType.RECTANGLE, 'test:child')
    graph.appendChild(0, rootIndex)
    graph.appendChild(rootIndex, childIndex)

    const root = new NodeCursor(graph, rootIndex)
    root.width = 100
    root.height = 100

    const child = new NodeCursor(graph, childIndex)
    child.x = 10
    child.y = 20
    child.width = 10
    child.height = 10

    const system = new TransformSystem(graph)
    const transactions = getTransactionManager(graph)
    transactions.begin('Resize Group', ['test:group'])
    system.resize(['test:group'], 200, 50)
    system.resize(['test:group'], 150, 75)

    expect(root.width).toBe(150)
    expect(root.height).toBe(75)
    expect(child.x).toBe(15)
    expect(child.y).toBe(15)
    expect(child.width).toBe(15)
    expect(child.height).toBe(7.5)
  })

  it('resize preserves rendered corners for deeply nested non-uniform world scaling', () => {
    const graph = new SceneGraph()
    const rootIndex = graph.createNode(NodeType.GROUP, 'test:root')
    const middleIndex = graph.createNode(NodeType.GROUP, 'test:middle')
    const leafIndex = graph.createNode(NodeType.RECTANGLE, 'test:leaf')
    graph.appendChild(0, rootIndex)
    graph.appendChild(rootIndex, middleIndex)
    graph.appendChild(middleIndex, leafIndex)

    const root = new NodeCursor(graph, rootIndex)
    root.width = 100
    root.height = 80
    const rootMatrix = mat2d.create()
    mat2d.translate(rootMatrix, rootMatrix, [120, 40])
    mat2d.rotate(rootMatrix, rootMatrix, Math.PI / 6)
    root.transform = rootMatrix

    const middle = new NodeCursor(graph, middleIndex)
    middle.width = 40
    middle.height = 30
    const middleMatrix = mat2d.create()
    mat2d.translate(middleMatrix, middleMatrix, [20, 15])
    mat2d.rotate(middleMatrix, middleMatrix, -Math.PI / 8)
    middle.transform = middleMatrix

    const leaf = new NodeCursor(graph, leafIndex)
    leaf.width = 30
    leaf.height = 12
    const leafMatrix = mat2d.create()
    mat2d.translate(leafMatrix, leafMatrix, [8, 6])
    mat2d.rotate(leafMatrix, leafMatrix, Math.PI / 5)
    leaf.transform = leafMatrix

    const leafWorld = multiply(rootMatrix, middleMatrix, leafMatrix)
    const rootWorldInv = mat2d.invert(mat2d.create(), rootMatrix)
    expect(rootWorldInv).not.toBeNull()
    const scaleInRootBasis = mat2d.fromScaling(mat2d.create(), [1.5, 0.625])
    const worldStep = multiply(
      rootMatrix,
      scaleInRootBasis,
      rootWorldInv as mat2d
    )
    const expectedCorners = transformCorners(
      leafWorld,
      leaf.width,
      leaf.height
    ).map(point => vec2.transformMat2d(vec2.create(), point, worldStep))

    const system = new TransformSystem(graph)
    const transactions = getTransactionManager(graph)
    transactions.begin('Resize Group', ['test:root'])
    system.resize(['test:root'], 150, 50)
    flushMatrix(graph)

    const actualWorld = TransformOps.getWorldMatrix(graph, leafIndex)
    const actualCorners = transformCorners(actualWorld, leaf.width, leaf.height)

    for (let i = 0; i < actualCorners.length; i += 1) {
      expectClosePoint(actualCorners[i], expectedCorners[i])
    }
  })
})
