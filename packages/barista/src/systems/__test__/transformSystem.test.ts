import { NodeType } from '@latte-js/bean'
import { NodeCursor, SceneGraph } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import {
  getHistoryManager,
  getTransactionManager,
} from '../../transactions/transactionRegistry'
import { TransformSystem } from '../transform'

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
})
