import { NodeType } from '@latte-js/bean'
import { NodeCursor, SceneGraph } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { HistoryManager } from '../historyManager'
import { TransactionManager } from '../../transactions/transactionManager'

const createManagers = (graph: SceneGraph) => {
  const transactions = new TransactionManager(graph)
  const history = new HistoryManager(graph, transactions)
  return { transactions, history }
}

describe('HistoryManager', () => {
  it('undoes and redoes committed mutation records', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    const { transactions, history } = createManagers(graph)
    cursor.x = 10
    cursor.y = 20

    transactions.begin('Move Layer', ['test:rect'])
    cursor.x = 50
    cursor.y = 60
    history.push(transactions.commit())

    expect(history.undo()).toBe(true)
    expect(cursor.x).toBe(10)
    expect(cursor.y).toBe(20)
    expect(history.canRedo).toBe(true)

    expect(history.redo()).toBe(true)
    expect(cursor.x).toBe(50)
    expect(cursor.y).toBe(60)
    expect(history.canUndo).toBe(true)
  })

  it('clears redo when a new transaction is pushed after undo', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    const { transactions, history } = createManagers(graph)

    transactions.begin('Move Layer', ['test:rect'])
    cursor.x = 50
    history.push(transactions.commit())
    history.undo()
    expect(history.canRedo).toBe(true)

    transactions.begin('Move Layer Again', ['test:rect'])
    cursor.x = 25
    history.push(transactions.commit())

    expect(history.canRedo).toBe(false)
    expect(history.peekUndo()?.label).toBe('Move Layer Again')
  })

  it('returns false when undo or redo has no entry', () => {
    const graph = new SceneGraph()
    const { history } = createManagers(graph)

    expect(history.undo()).toBe(false)
    expect(history.redo()).toBe(false)
  })

  it('rejects undo while a transaction is active', () => {
    const graph = new SceneGraph()
    graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const { transactions, history } = createManagers(graph)

    transactions.begin('Move Layer', ['test:rect'])

    expect(() => history.undo()).toThrow(
      'Cannot undo while a transaction is active'
    )
    transactions.abort()
  })
})
