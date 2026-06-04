import { NodeType } from '@latte-js/bean'
import { NodeCursor, PropId, SceneGraph } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { TransactionManager } from '../transactionManager'

describe('TransactionManager', () => {
  it('collects NodeCursor mutation records while active', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    const manager = new TransactionManager(graph)

    manager.begin('Move Layer', ['test:rect'])
    cursor.x = 16
    cursor.y = 32

    expect(manager.getMutationRecords()).toMatchObject([
      {
        id: 'test:rect',
        index,
        prop: PropId.X,
        oldValue: 0,
        newValue: 16,
      },
      {
        id: 'test:rect',
        index,
        prop: PropId.Y,
        oldValue: 0,
        newValue: 32,
      },
    ])
  })

  it('releases the graph recorder after commit', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    const manager = new TransactionManager(graph)

    manager.begin('Move Layer', ['test:rect'])
    cursor.x = 12
    expect(graph.getMutationRecorder()).toBe(manager)

    const committed = manager.commit()
    expect(graph.getMutationRecorder()).toBeNull()
    expect(committed?.label).toBe('Move Layer')
    expect(committed?.records).toMatchObject([
      {
        id: 'test:rect',
        prop: PropId.X,
        oldValue: 0,
        newValue: 12,
      },
    ])
  })

  it('releases the graph recorder before abort rollback', () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    const manager = new TransactionManager(graph)
    cursor.x = 10

    manager.begin('Move Layer', ['test:rect'])
    cursor.x = 50
    manager.abort()

    expect(cursor.x).toBe(10)
    expect(graph.getMutationRecorder()).toBeNull()
  })
})
