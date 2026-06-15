import { NodeType } from '@latte-js/bean'
import { NodeCursor, PropId, SceneGraph } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { HistoryManager } from '../historyManager'
import { TransactionLabel } from '../../transactions/transactionLabels'
import { TransactionManager } from '../../transactions/transactionManager'

const RESOURCE_ID = 'doc:test'

const createManagers = (graph: SceneGraph) => {
  const transactions = new TransactionManager(graph)
  const history = new HistoryManager(graph)
  return { transactions, history }
}

const createResourceManagers = (graph: SceneGraph) => {
  const transactions = new Map<string, TransactionManager>()
  const getTransactions = (resourceId: string) => {
    let manager = transactions.get(resourceId)
    if (!manager) {
      manager = new TransactionManager(graph)
      transactions.set(resourceId, manager)
    }
    return manager
  }
  const history = new HistoryManager(graph)
  return { getTransactions, history }
}

describe('HistoryManager', () => {
  it('undoes and redoes committed mutation records', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    const { transactions, history } = createManagers(graph)
    cursor.x = 10
    cursor.y = 20

    transactions.begin(TransactionLabel.MoveLayer, ['test:rect'])
    cursor.x = 50
    cursor.y = 60
    history.push(RESOURCE_ID, transactions.commit())

    expect(history.undo(RESOURCE_ID)).toBe(true)
    expect(cursor.x).toBe(10)
    expect(cursor.y).toBe(20)
    expect(history.canRedo(RESOURCE_ID)).toBe(true)

    expect(history.redo(RESOURCE_ID)).toBe(true)
    expect(cursor.x).toBe(50)
    expect(cursor.y).toBe(60)
    expect(history.canUndo(RESOURCE_ID)).toBe(true)
  })

  it('clears redo when a new transaction is pushed after undo', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    const { transactions, history } = createManagers(graph)

    transactions.begin(TransactionLabel.MoveLayer, ['test:rect'])
    cursor.x = 50
    history.push(RESOURCE_ID, transactions.commit())
    history.undo(RESOURCE_ID)
    expect(history.canRedo(RESOURCE_ID)).toBe(true)

    transactions.begin('Move Layer Again', ['test:rect'])
    cursor.x = 25
    history.push(RESOURCE_ID, transactions.commit())

    expect(history.canRedo(RESOURCE_ID)).toBe(false)
    expect(history.peekUndo(RESOURCE_ID)?.label).toBe('Move Layer Again')
  })

  it('returns false when undo or redo has no entry', () => {
    const graph = new SceneGraph()
    const { history } = createManagers(graph)

    expect(history.undo(RESOURCE_ID)).toBe(false)
    expect(history.redo(RESOURCE_ID)).toBe(false)
  })

  it('rejects undo while a mutation recorder is active', () => {
    const graph = new SceneGraph()
    graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const { transactions, history } = createManagers(graph)

    transactions.begin(TransactionLabel.MoveLayer, ['test:rect'])

    expect(() => history.undo(RESOURCE_ID)).toThrow(
      'Cannot undo while another mutation recorder is active'
    )
    transactions.abort()
  })

  it('keeps undo and redo stacks per resource id', () => {
    const graph = new SceneGraph()
    const indexA = graph.createNode(NodeType.RECTANGLE, 'test:a')
    const indexB = graph.createNode(NodeType.RECTANGLE, 'test:b')
    const cursorA = new NodeCursor(graph, indexA)
    const cursorB = new NodeCursor(graph, indexB)
    const { getTransactions, history } = createResourceManagers(graph)

    const docA = getTransactions('doc:a')
    docA.begin('Move A', ['test:a'])
    cursorA.x = 10
    history.push('doc:a', docA.commit())

    const docB = getTransactions('doc:b')
    docB.begin('Move B', ['test:b'])
    cursorB.x = 20
    history.push('doc:b', docB.commit())

    expect(history.canUndo('doc:a')).toBe(true)
    expect(history.canUndo('doc:b')).toBe(true)

    expect(history.undo('doc:a')).toBe(true)
    expect(cursorA.x).toBe(0)
    expect(cursorB.x).toBe(20)
    expect(history.canRedo('doc:a')).toBe(true)
    expect(history.canRedo('doc:b')).toBe(false)

    expect(history.undo('doc:b')).toBe(true)
    expect(cursorB.x).toBe(0)
  })

  it('coalesces repeated field changes before storing history', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    const { transactions, history } = createManagers(graph)

    transactions.begin(TransactionLabel.MoveLayer, ['test:rect'])
    cursor.x = 10
    cursor.x = 20
    cursor.x = 30
    history.push(RESOURCE_ID, transactions.commit())

    const entry = history.peekUndo(RESOURCE_ID)
    expect(entry?.records).toHaveLength(1)
    expect(entry?.records[0]).toMatchObject({
      id: 'test:rect',
      prop: PropId.X,
      oldValue: 0,
      newValue: 30,
    })

    expect(history.undo(RESOURCE_ID)).toBe(true)
    expect(cursor.x).toBe(0)
    expect(history.redo(RESOURCE_ID)).toBe(true)
    expect(cursor.x).toBe(30)
  })

  it('does not coalesce records across structural barriers', () => {
    const graph = new SceneGraph()
    const history = new HistoryManager(graph)

    history.push(RESOURCE_ID, {
      label: 'Barrier',
      records: [
        {
          id: 'test:rect',
          index: 1,
          prop: PropId.X,
          oldValue: 0,
          newValue: 10,
          dirtyFlag: 1,
        },
        {
          id: 'test:rect',
          index: 1,
          prop: PropId.PARENT,
          oldValue: null,
          newValue: 'test:parent',
          dirtyFlag: 4,
        },
        {
          id: 'test:rect',
          index: 1,
          prop: PropId.X,
          oldValue: 10,
          newValue: 20,
          dirtyFlag: 1,
        },
      ],
    })

    expect(
      history.peekUndo(RESOURCE_ID)?.records.map(record => record.prop)
    ).toEqual([PropId.X, PropId.PARENT, PropId.X])
  })
})
