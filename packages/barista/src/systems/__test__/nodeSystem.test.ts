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
})
