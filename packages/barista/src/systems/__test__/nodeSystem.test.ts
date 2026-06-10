import { NodeType } from '@latte-js/bean'
import { DIRTY_TREE, SceneGraph } from '@latte-js/espresso'
import { describe, expect, it, vi } from 'vitest'

import { NodeSystem } from '../node'

describe('NodeSystem', () => {
  it('emits deleted descendants when removing a subtree', async () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:parent')
    const child = graph.createNode(NodeType.RECTANGLE, 'test:child')
    graph.appendChild(parent, child)

    const system = new NodeSystem(graph)
    const onDelete = vi.fn()
    system.onDelete(onDelete)

    await system.remove('test:parent')

    expect(onDelete).toHaveBeenCalledWith([
      ['test:parent', parent],
      ['test:child', child],
    ])
  })

  it('marks the old parent dirty when removing a subtree', async () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:parent')
    const child = graph.createNode(NodeType.RECTANGLE, 'test:child')
    graph.appendChild(0, parent)
    graph.appendChild(parent, child)
    graph.tracker.flush()

    const system = new NodeSystem(graph)

    await system.remove('test:parent')

    const dirty = graph.tracker.flush()
    expect(dirty.get(0)! & DIRTY_TREE).toBeTruthy()
  })

  it('appends when insertAfter is called without a ref id', async () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:parent')
    const child = graph.createNode(NodeType.RECTANGLE, 'test:child')
    const system = new NodeSystem(graph)

    await system.insertAfter('test:parent', 'test:child')

    expect(graph.parent[child]).toBe(parent)
    expect(graph.firstChild[parent]).toBe(child)
  })

  it('marks hierarchy dirty when inserting a child', async () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:parent')
    const child = graph.createNode(NodeType.RECTANGLE, 'test:child')
    const system = new NodeSystem(graph)
    graph.tracker.flush()

    await system.insertAfter('test:parent', 'test:child')

    const dirty = graph.tracker.flush()
    expect(dirty.get(parent)! & DIRTY_TREE).toBeTruthy()
    expect(dirty.get(child)! & DIRTY_TREE).toBeTruthy()
  })

  it('marks hierarchy dirty when detaching a child', async () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:parent')
    const child = graph.createNode(NodeType.RECTANGLE, 'test:child')
    graph.appendChild(parent, child)
    graph.tracker.flush()

    const system = new NodeSystem(graph)

    await system.removeChild('test:child')

    const dirty = graph.tracker.flush()
    expect(dirty.get(parent)! & DIRTY_TREE).toBeTruthy()
    expect(dirty.get(child)! & DIRTY_TREE).toBeTruthy()
  })

  it('scopes create events by the active session context', async () => {
    const graphA = new SceneGraph()
    const graphB = new SceneGraph()
    let currentSessionId = 'doc:a'
    let sceneGraph = graphA
    const system = new NodeSystem({
      get currentSessionId() {
        return currentSessionId
      },
      get sceneGraph() {
        return sceneGraph
      },
    })
    const onCreateA = vi.fn()
    const onCreateB = vi.fn()

    system.onCreate(onCreateA)
    currentSessionId = 'doc:b'
    sceneGraph = graphB
    system.onCreate(onCreateB)

    currentSessionId = 'doc:a'
    sceneGraph = graphA
    await system.create('test:a', NodeType.RECTANGLE, 0, 0)

    currentSessionId = 'doc:b'
    sceneGraph = graphB
    await system.create('test:b', NodeType.RECTANGLE, 0, 0)

    expect(onCreateA).toHaveBeenCalledTimes(1)
    expect(onCreateA).toHaveBeenCalledWith([['test:a', 1]])
    expect(onCreateB).toHaveBeenCalledTimes(1)
    expect(onCreateB).toHaveBeenCalledWith([['test:b', 1]])
  })
})
