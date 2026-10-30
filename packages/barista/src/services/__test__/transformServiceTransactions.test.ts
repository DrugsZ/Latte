import { Channels, DEFAULT_SCENE_GRAPH_NAME, NodeType } from '@latte-js/bean'
import {
  NodeCursor,
  NodeLifecycle,
  NULL_INDEX,
  SceneGraph,
} from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { fromService } from '../../ipc'
import { BaristaSystem } from '../../systems'
import {
  MutationGate,
  MutationPolicyKind,
} from '../../transactions/mutationPolicy'
import { TransformService } from '../transform'
import { NodeService } from '../node'
import { UndoRedoService } from '../undoRedo'

const ctx = (sessionId = '') => ({ sessionId })
const contextByGraph = new WeakMap<
  SceneGraph,
  ReturnType<typeof createContext>
>()
const gateByGraph = new WeakMap<SceneGraph, MutationGate>()

const createContext = (graph: SceneGraph) => {
  const existing = contextByGraph.get(graph)
  if (existing) {
    return existing
  }

  const context = {
    sceneGraph: graph,
    mutationAuthority: graph.createMutationAuthority('test'),
    accessSystem: new BaristaSystem(graph),
    currentSessionId: DEFAULT_SCENE_GRAPH_NAME,
    getService: () => {
      throw new Error('getService is not used in transform service tests')
    },
  }
  contextByGraph.set(graph, context)
  return context
}

const createMutationGate = (graph: SceneGraph) => {
  let gate = gateByGraph.get(graph)
  if (!gate) {
    gate = new MutationGate(createContext(graph))
    gateByGraph.set(graph, gate)
  }
  return gate
}

describe('TransformService transactions', () => {
  const createTransformChannel = (graph: SceneGraph) => {
    const transform = new TransformService(createContext(graph))
    return fromService(transform, {
      channelName: Channels.Transform,
      mutationGate: createMutationGate(graph),
    })
  }

  const createUndoRedoChannel = (graph: SceneGraph) => {
    const undoRedo = new UndoRedoService(createContext(graph))
    return fromService(undoRedo, {
      channelName: Channels.UndoRedo,
      mutationGate: createMutationGate(graph),
    })
  }

  const createNodeChannel = (
    graph: SceneGraph,
    gate = createMutationGate(graph)
  ) =>
    fromService(new NodeService(createContext(graph)), {
      channelName: Channels.Node,
      mutationGate: gate,
    })

  it('wraps a standalone transform RPC in worker-owned history', async () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    cursor.x = 10
    cursor.y = 20

    const transform = createTransformChannel(graph)
    const undoRedo = createUndoRedoChannel(graph)

    await transform.call(ctx(), 'moveBy', ['test:rect'], [5, 7])

    expect(cursor.x).toBe(15)
    expect(cursor.y).toBe(27)
    expect(await undoRedo.call(ctx(), 'canUndo')).toBe(true)
    expect(await undoRedo.call(ctx(), 'undo')).toBe(true)
    expect(cursor.x).toBe(10)
    expect(cursor.y).toBe(20)

    expect(await undoRedo.call(ctx(), 'redo')).toBe(true)
    expect(cursor.x).toBe(15)
    expect(cursor.y).toBe(27)
  })

  it.each([
    ['moveTo', [['test:rect'], [1e40, 0]]],
    ['moveBy', [['test:rect'], [0, -1e40]]],
    ['resize', [['test:rect'], 1e40, 10]],
    ['transformAround', [['test:rect'], [1e40, 0, 0, 1, 0, 0], [0, 0]]],
    ['transformAround', [['test:rect'], [1, 0, 0, 1, 0, 0], [1e40, 0]]],
  ])(
    'rejects float32 overflow from %s RPC without model/history changes',
    async (command, args) => {
      const graph = new SceneGraph()
      const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
      const cursor = new NodeCursor(graph, index)
      cursor.x = 10
      cursor.width = 50
      cursor.height = 60
      const transform = createTransformChannel(graph)
      const history = createUndoRedoChannel(graph)

      await expect(
        transform.call(ctx(), command as string, ...(args as unknown[]))
      ).rejects.toThrow('Invalid')
      expect(Array.from(cursor.transform)).toEqual([1, 0, 0, 1, 10, 0])
      expect([cursor.width, cursor.height]).toEqual([50, 60])
      expect(await history.call(ctx(), 'canUndo')).toBe(false)
    }
  )

  it.each(['x', 'y', 'width', 'height'])(
    'rejects overflowing create %s before allocation',
    async key => {
      const graph = new SceneGraph()
      const node = createNodeChannel(graph)
      const history = createUndoRedoChannel(graph)
      await expect(
        node.call(ctx(), 'createNode', {
          id: 'test:overflow',
          type: NodeType.RECTANGLE,
          [key]: 1e40,
        })
      ).rejects.toThrow(`Invalid ${key}`)
      expect(graph.getIndex('test:overflow')).toBe(NULL_INDEX)
      expect(graph.getTombstoneIndex('test:overflow')).toBe(NULL_INDEX)
      expect(await history.call(ctx(), 'canUndo')).toBe(false)
    }
  )

  it('rolls back earlier selection targets when a computed local transform overflows', async () => {
    const graph = new SceneGraph()
    const first = new NodeCursor(
      graph,
      graph.createNode(NodeType.RECTANGLE, 'test:first')
    )
    const parent = new NodeCursor(
      graph,
      graph.createNode(NodeType.GROUP, 'test:parent')
    )
    const child = new NodeCursor(
      graph,
      graph.createNode(NodeType.RECTANGLE, 'test:child')
    )
    graph.appendChild(parent.index, child.index)
    parent.transform = [1e-20, 0, 0, 1e-20, 0, 0]
    const transform = createTransformChannel(graph)
    const history = createUndoRedoChannel(graph)

    await expect(
      transform.call(ctx(), 'moveBy', ['test:first', 'test:child'], [1e20, 0])
    ).rejects.toThrow('computed local matrix')
    expect(Array.from(first.transform)).toEqual([1, 0, 0, 1, 0, 0])
    expect(Array.from(child.transform)).toEqual([1, 0, 0, 1, 0, 0])
    expect(await history.call(ctx(), 'canUndo')).toBe(false)
  })

  it('rejects an overflowing computed sum even when both input positions fit float32', async () => {
    const graph = new SceneGraph()
    const cursor = new NodeCursor(
      graph,
      graph.createNode(NodeType.RECTANGLE, 'test:rect')
    )
    cursor.x = 3e38
    const before = Array.from(cursor.transform)
    const transform = createTransformChannel(graph)
    const history = createUndoRedoChannel(graph)
    await expect(
      transform.call(ctx(), 'moveBy', ['test:rect'], [3e38, 0])
    ).rejects.toThrow('target world matrix')
    expect(Array.from(cursor.transform)).toEqual(before)
    expect(await history.call(ctx(), 'canUndo')).toBe(false)
  })

  it('rolls back a parent resize if the resulting descendant dimensions overflow', async () => {
    const graph = new SceneGraph()
    const parent = new NodeCursor(
      graph,
      graph.createNode(NodeType.GROUP, 'test:parent')
    )
    const child = new NodeCursor(
      graph,
      graph.createNode(NodeType.RECTANGLE, 'test:child')
    )
    graph.appendChild(parent.index, child.index)
    parent.width = 1
    parent.height = 1
    child.width = 3e38
    child.height = 10
    const originalChildWidth = child.width
    const transform = createTransformChannel(graph)
    const history = createUndoRedoChannel(graph)

    await expect(
      transform.call(ctx(), 'resize', ['test:parent'], 2, 1)
    ).rejects.toThrow('Invalid resize dimensions')
    expect([parent.width, parent.height]).toEqual([1, 1])
    expect([child.width, child.height]).toEqual([originalChildWidth, 10])
    expect(Array.from(child.transform)).toEqual([1, 0, 0, 1, 0, 0])
    expect(await history.call(ctx(), 'canUndo')).toBe(false)
  })

  it('owns transform interaction commit inside the worker', async () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    cursor.x = 10
    cursor.y = 20

    const gate = createMutationGate(graph)
    const transform = fromService(new TransformService(createContext(graph)), {
      channelName: Channels.Transform,
      mutationGate: gate,
    })
    const undoRedo = fromService(new UndoRedoService(createContext(graph)), {
      channelName: Channels.UndoRedo,
      mutationGate: gate,
    })

    await transform.call(ctx(), 'beginTransform', ['test:rect'], 'Drag Layer')
    await transform.call(ctx(), 'moveBy$', ['test:rect'], [5, 0])
    await transform.call(ctx(), 'moveBy', ['test:rect'], [7, 0])
    await transform.call(ctx(), 'commitTransform')

    expect(cursor.x).toBe(17)
    expect(await undoRedo.call(ctx(), 'undo')).toBe(true)
    expect(cursor.x).toBe(10)
    expect(await undoRedo.call(ctx(), 'redo')).toBe(true)
    expect(cursor.x).toBe(17)
  })

  it('cancels transform interaction edits inside the worker', async () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    cursor.x = 10
    cursor.y = 20

    const transform = createTransformChannel(graph)

    await transform.call(ctx(), 'beginTransform', ['test:rect'], 'Drag Layer')
    await transform.call(ctx(), 'moveBy$', ['test:rect'], [40, 30])
    await transform.call(ctx(), 'cancelTransform')

    expect(cursor.x).toBe(10)
    expect(cursor.y).toBe(20)
  })

  it('rejects transform notifications outside a transform interaction', async () => {
    const graph = new SceneGraph()
    graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const transform = createTransformChannel(graph)

    await expect(
      transform.call(ctx(), 'moveBy$', ['test:rect'], [1, 1])
    ).rejects.toThrow('requires an active mutation session')
  })

  it('rejects NodeCursor writes from readonly service calls', async () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    const channel = fromService(
      {
        getMutationPolicy: () => ({ kind: MutationPolicyKind.Readonly }),
        async write() {
          cursor.x = 10
        },
      },
      {
        channelName: 'test',
        mutationGate: createMutationGate(graph),
      }
    )

    await expect(channel.call(ctx(), 'write')).rejects.toThrow(
      'Mutation outside permitted scope'
    )
  })

  it('rejects dirty history mutations without mutation records', async () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:parent')
    const child = graph.createNode(NodeType.RECTANGLE, 'test:child')
    graph.appendChild(parent, child)

    const channel = fromService(
      {
        getMutationPolicy: () => ({
          kind: MutationPolicyKind.Atomic,
          label: 'Unsafe Detach',
          ids: ['test:child'],
        }),
        async detachWithoutRecord() {
          graph.detach(child)
        },
      },
      {
        channelName: 'test',
        mutationGate: createMutationGate(graph),
      }
    )

    await expect(channel.call(ctx(), 'detachWithoutRecord')).rejects.toThrow(
      'Dirty mutation without history record'
    )
  })

  it('keeps the active session guard scoped by session id', async () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    const gate = createMutationGate(graph)
    const transform = fromService(new TransformService(createContext(graph)), {
      channelName: Channels.Transform,
      mutationGate: gate,
    })

    await transform.call(
      ctx('doc:a'),
      'beginTransform',
      ['test:rect'],
      'Drag Layer'
    )

    await expect(
      transform.call(ctx('doc:b'), 'moveBy', ['test:rect'], [10, 0])
    ).rejects.toThrow('another mutation recorder is active')
    expect(cursor.x).toBe(0)

    await transform.call(ctx('doc:a'), 'cancelTransform')
  })

  it('records created nodes in worker-owned history', async () => {
    const graph = new SceneGraph()
    const gate = createMutationGate(graph)
    const node = createNodeChannel(graph, gate)
    const undoRedo = fromService(new UndoRedoService(createContext(graph)), {
      channelName: Channels.UndoRedo,
      mutationGate: gate,
    })

    await node.call(ctx(), 'createNode', {
      id: 'test:new',
      type: NodeType.RECTANGLE,
      x: 10,
      y: 20,
    })
    const index = graph.getIndex('test:new')

    expect(index).not.toBe(NULL_INDEX)
    expect(await undoRedo.call(ctx(), 'undo')).toBe(true)
    expect(graph.getIndex('test:new')).toBe(NULL_INDEX)
    expect(graph.getTombstoneIndex('test:new')).toBe(index)

    expect(await undoRedo.call(ctx(), 'redo')).toBe(true)
    expect(graph.getIndex('test:new')).toBe(index)
    const cursor = new NodeCursor(graph, index)
    expect(cursor.x).toBe(10)
    expect(cursor.y).toBe(20)
    expect(cursor.width).toBe(100)
    expect(cursor.height).toBe(100)
  })

  it('creates and attaches a rectangle as one undoable operation', async () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.CANVAS, 'test:page')
    const node = createNodeChannel(graph)
    const history = createUndoRedoChannel(graph)

    await node.call(ctx(), 'createNode', {
      id: 'test:new',
      type: NodeType.RECTANGLE,
      parentId: 'test:page',
      name: 'Rectangle',
      fills: [
        {
          type: 'SOLID',
          visible: true,
          opacity: 1,
          blendMode: 0,
          color: { r: 0.75, g: 0.78, b: 0.84, a: 1 },
        },
      ],
      x: 30,
      y: 40,
      width: 120,
      height: 80,
    })
    const index = graph.getIndex('test:new')
    expect(graph.parent[index]).toBe(parent)
    expect(graph.firstChild[parent]).toBe(index)

    expect(await history.call(ctx(), 'undo')).toBe(true)
    expect(graph.getIndex('test:new')).toBe(NULL_INDEX)
    expect(graph.firstChild[parent]).toBe(NULL_INDEX)
    expect(await history.call(ctx(), 'canUndo')).toBe(false)

    expect(await history.call(ctx(), 'redo')).toBe(true)
    expect(graph.getIndex('test:new')).toBe(index)
    expect(graph.parent[index]).toBe(parent)
    const restored = new NodeCursor(graph, index)
    expect(restored.name).toBe('Rectangle')
    expect(restored.fills).toEqual([
      {
        type: 'SOLID',
        visible: true,
        opacity: 1,
        blendMode: 0,
        color: { r: 0.75, g: 0.78, b: 0.84, a: 1 },
      },
    ])
    expect([restored.x, restored.y, restored.width, restored.height]).toEqual([
      30, 40, 120, 80,
    ])
  })

  it('rejects creation under a missing parent without orphan nodes or history', async () => {
    const graph = new SceneGraph()
    const node = createNodeChannel(graph)
    const history = createUndoRedoChannel(graph)

    await expect(
      node.call(ctx(), 'createNode', {
        id: 'test:new',
        type: NodeType.RECTANGLE,
        parentId: 'test:missing',
      })
    ).rejects.toThrow('Parent not found')
    expect(graph.getIndex('test:new')).toBe(NULL_INDEX)
    expect(graph.getTombstoneIndex('test:new')).toBe(NULL_INDEX)
    expect(await history.call(ctx(), 'canUndo')).toBe(false)
  })

  it('rejects invalid creation style before allocating nodes or recording history', async () => {
    const graph = new SceneGraph()
    const node = createNodeChannel(graph)
    const history = createUndoRedoChannel(graph)
    await expect(
      node.call(ctx(), 'createNode', {
        id: 'test:new',
        type: NodeType.RECTANGLE,
        fills: [
          {
            type: 'SOLID',
            visible: true,
            opacity: 2,
            blendMode: 0,
            color: { r: 0, g: 0, b: 0, a: 1 },
          },
        ],
      })
    ).rejects.toThrow('Invalid solid fill')
    expect(graph.getIndex('test:new')).toBe(NULL_INDEX)
    expect(graph.getTombstoneIndex('test:new')).toBe(NULL_INDEX)
    expect(await history.call(ctx(), 'canUndo')).toBe(false)
  })

  it('finalizes abandoned create tombstones when redo history is cleared', async () => {
    const graph = new SceneGraph()
    const gate = createMutationGate(graph)
    const node = createNodeChannel(graph, gate)
    const undoRedo = fromService(new UndoRedoService(createContext(graph)), {
      channelName: Channels.UndoRedo,
      mutationGate: gate,
    })

    await node.call(ctx(), 'createNode', {
      id: 'test:temp',
      type: NodeType.RECTANGLE,
    })
    const tombstoneIndex = graph.getIndex('test:temp')

    expect(await undoRedo.call(ctx(), 'undo')).toBe(true)
    expect(graph.getTombstoneIndex('test:temp')).toBe(tombstoneIndex)

    await node.call(ctx(), 'createNode', {
      id: 'test:other',
      type: NodeType.RECTANGLE,
    })

    expect(graph.getTombstoneIndex('test:temp')).toBe(NULL_INDEX)
    expect(graph.type[tombstoneIndex]).toBe(0)
    expect(graph.lifecycle[tombstoneIndex]).toBe(NodeLifecycle.Free)
    await node.call(ctx(), 'createNode', {
      id: 'test:temp',
      type: NodeType.RECTANGLE,
      x: 1,
      y: 1,
    })
    expect(graph.getIndex('test:temp')).not.toBe(NULL_INDEX)
  })

  it('restores deleted nodes at their original sibling position', async () => {
    const graph = new SceneGraph()
    const parent = graph.createNode(NodeType.GROUP, 'test:parent')
    const left = graph.createNode(NodeType.RECTANGLE, 'test:left')
    const target = graph.createNode(NodeType.RECTANGLE, 'test:target')
    const right = graph.createNode(NodeType.RECTANGLE, 'test:right')
    graph.appendChild(0, parent)
    graph.appendChild(parent, left)
    graph.appendChild(parent, target)
    graph.appendChild(parent, right)

    const gate = createMutationGate(graph)
    const node = createNodeChannel(graph, gate)
    const undoRedo = fromService(new UndoRedoService(createContext(graph)), {
      channelName: Channels.UndoRedo,
      mutationGate: gate,
    })

    await node.call(ctx(), 'deleteNode', 'test:target')

    expect(graph.getIndex('test:target')).toBe(NULL_INDEX)
    expect(graph.nextSibling[left]).toBe(right)

    expect(await undoRedo.call(ctx(), 'undo')).toBe(true)
    expect(graph.getIndex('test:target')).toBe(target)
    expect(graph.nextSibling[left]).toBe(target)
    expect(graph.nextSibling[target]).toBe(right)

    expect(await undoRedo.call(ctx(), 'redo')).toBe(true)
    expect(graph.getIndex('test:target')).toBe(NULL_INDEX)
    expect(graph.nextSibling[left]).toBe(right)
  })
})
