import { NodeType } from '@latte-js/bean'
import { DIRTY_TREE, SceneGraph } from '@latte-js/espresso'
import { describe, expect, it, vi } from 'vitest'

import { NodeSystem } from '../node'
import { NodeService } from '../../services/node'

import type { BaristaSystem } from '../systems'

describe('NodeSystem', () => {
  it('emits deleted descendants when removing a subtree', async () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:parent')
    const child = graph.createNode(NodeType.RECTANGLE, 'test:child')
    graph.appendChild(parent, child)

    const system = new NodeSystem(graph)
    const onDelete = vi.fn()
    system.onDidDeleteNode(event => onDelete(event.nodes))

    await system.deleteNode('test:parent')

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

    await system.deleteNode('test:parent')

    const dirty = graph.tracker.flush()
    expect(dirty.get(0)! & DIRTY_TREE).toBeTruthy()
  })

  it('appends a child using DOM-like appendChild', async () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:parent')
    const child = graph.createNode(NodeType.RECTANGLE, 'test:child')
    const system = new NodeSystem(graph)

    await system.appendChild('test:parent', 'test:child')

    expect(graph.parent[child]).toBe(parent)
    expect(graph.firstChild[parent]).toBe(child)
  })

  it('appends when insertBefore is called with a null ref', async () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:parent')
    const child = graph.createNode(NodeType.RECTANGLE, 'test:child')
    const system = new NodeSystem(graph)

    await system.insertBefore('test:parent', 'test:child', null)

    expect(graph.parent[child]).toBe(parent)
    expect(graph.firstChild[parent]).toBe(child)
  })

  it('inserts a child before the reference node', async () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:parent')
    const first = graph.createNode(NodeType.RECTANGLE, 'test:first')
    const second = graph.createNode(NodeType.RECTANGLE, 'test:second')
    const system = new NodeSystem(graph)
    graph.appendChild(parent, first)

    await system.insertBefore('test:parent', 'test:second', 'test:first')

    expect(graph.firstChild[parent]).toBe(second)
    expect(graph.nextSibling[second]).toBe(first)
    expect(graph.prevSibling[first]).toBe(second)
  })

  it('marks hierarchy dirty when inserting a child', async () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:parent')
    const child = graph.createNode(NodeType.RECTANGLE, 'test:child')
    const system = new NodeSystem(graph)
    graph.tracker.flush()

    await system.appendChild('test:parent', 'test:child')

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

    await system.removeChild('test:parent', 'test:child')

    const dirty = graph.tracker.flush()
    expect(dirty.get(parent)! & DIRTY_TREE).toBeTruthy()
    expect(dirty.get(child)! & DIRTY_TREE).toBeTruthy()
  })

  it('rejects removeChild when parent does not own the child', async () => {
    const graph = new SceneGraph()
    graph.createNode(NodeType.GROUP, 'test:parent')
    graph.createNode(NodeType.RECTANGLE, 'test:child')
    const system = new NodeSystem(graph)

    await expect(
      system.removeChild('test:parent', 'test:child')
    ).rejects.toThrow('removeChild child is not child of parent')
  })

  it('emits system create events with their active session id', async () => {
    const graphA = new SceneGraph()
    const graphB = new SceneGraph()
    let currentSessionId = 'doc:a'
    let sceneGraph = graphA
    const authorityA = graphA.createMutationAuthority('doc:a')
    const authorityB = graphB.createMutationAuthority('doc:b')
    const system = new NodeSystem({
      get currentSessionId() {
        return currentSessionId
      },
      get sceneGraph() {
        return sceneGraph
      },
      get mutationAuthority() {
        return sceneGraph === graphA ? authorityA : authorityB
      },
    })
    const onCreateA = vi.fn()

    system.onDidCreateNode(onCreateA)

    currentSessionId = 'doc:a'
    sceneGraph = graphA
    await system.createNode({ id: 'test:a', type: NodeType.RECTANGLE })

    currentSessionId = 'doc:b'
    sceneGraph = graphB
    await system.createNode({ id: 'test:b', type: NodeType.RECTANGLE })

    expect(onCreateA).toHaveBeenCalledTimes(2)
    expect(onCreateA).toHaveBeenNthCalledWith(1, {
      sessionId: 'doc:a',
      nodes: [['test:a', 1]],
    })
    expect(onCreateA).toHaveBeenNthCalledWith(2, {
      sessionId: 'doc:b',
      nodes: [['test:b', 1]],
    })
  })

  it('filters service create events by the subscribed session context', async () => {
    const graphA = new SceneGraph()
    const graphB = new SceneGraph()
    let currentSessionId = 'doc:a'
    let sceneGraph = graphA
    const authorityA = graphA.createMutationAuthority('doc:a')
    const authorityB = graphB.createMutationAuthority('doc:b')
    const system = new NodeSystem({
      get currentSessionId() {
        return currentSessionId
      },
      get sceneGraph() {
        return sceneGraph
      },
      get mutationAuthority() {
        return sceneGraph === graphA ? authorityA : authorityB
      },
    })
    const service = new NodeService({
      accessSystem: {
        getSystem: () => system,
      } as unknown as BaristaSystem,
      get currentSessionId() {
        return currentSessionId
      },
      get sceneGraph() {
        return sceneGraph
      },
      get mutationAuthority() {
        return sceneGraph === graphA ? authorityA : authorityB
      },
      getService() {
        throw new Error('getService is not used in node system tests')
      },
    })

    const onCreateA = vi.fn()
    const onCreateB = vi.fn()

    service.onDidCreateNode(onCreateA)
    currentSessionId = 'doc:b'
    sceneGraph = graphB
    service.onDidCreateNode(onCreateB)

    currentSessionId = 'doc:a'
    sceneGraph = graphA
    await service.createNode({ id: 'test:a', type: NodeType.RECTANGLE })

    currentSessionId = 'doc:b'
    sceneGraph = graphB
    await service.createNode({ id: 'test:b', type: NodeType.RECTANGLE })

    expect(onCreateA).toHaveBeenCalledTimes(1)
    expect(onCreateA).toHaveBeenCalledWith({ nodes: [['test:a', 1]] })
    expect(onCreateB).toHaveBeenCalledTimes(1)
    expect(onCreateB).toHaveBeenCalledWith({ nodes: [['test:b', 1]] })
  })
})
