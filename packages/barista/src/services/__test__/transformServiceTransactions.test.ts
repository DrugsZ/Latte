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
    await transform.call(ctx(), 'moveBy$', ['test:rect'], [6, 0])
    await transform.call(ctx(), 'moveBy', ['test:rect'], [7, 0])
    await transform.call(ctx(), 'commitTransform')

    expect(cursor.x).toBe(17)
    expect(await undoRedo.call(ctx(), 'undo')).toBe(true)
    expect(cursor.x).toBe(10)
    expect(await undoRedo.call(ctx(), 'canUndo')).toBe(false)
    expect(await undoRedo.call(ctx(), 'redo')).toBe(true)
    expect(cursor.x).toBe(17)
  })

  it('begins a transform session with frozen ids, revision, and group box for v2 updates', async () => {
    const graph = new SceneGraph()
    const firstIndex = graph.createNode(NodeType.RECTANGLE, 'test:first')
    const secondIndex = graph.createNode(NodeType.RECTANGLE, 'test:second')
    const first = new NodeCursor(graph, firstIndex)
    const second = new NodeCursor(graph, secondIndex)
    first.x = 10
    first.y = 20
    first.width = 30
    first.height = 40
    second.x = 100
    second.y = 20
    second.width = 30
    second.height = 40

    const transform = createTransformChannel(graph)
    const publishedRevision = graph.publicationRevision

    const session = await transform.call(ctx(), 'beginTransform', {
      ids: ['test:first', 'test:second'],
      operation: 'rotate',
      label: 'Rotate Selection',
    })

    expect(session).toMatchObject({
      baseRevision: publishedRevision,
      groupBox: {
        ids: ['test:first', 'test:second'],
        width: 120,
        height: 40,
      },
    })
    expect(session.sessionId).toMatch(/^transform:/)
    expect(session.sessionId).not.toBe(DEFAULT_SCENE_GRAPH_NAME)

    await transform.call(ctx(), 'updateTransform', {
      operation: {
        kind: 'rotate',
        request: {
          mode: 'total-delta',
          angle: 90,
          space: 'world',
          pivot: 'interaction-group-center',
        },
      },
    })
    await transform.call(ctx(), 'commitTransform')

    expect(first.x).not.toBe(10)
    expect(second.x).not.toBe(100)
  })

  it('rejects a stale transform token without ending the current session', async () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    cursor.width = 20
    cursor.height = 10
    const transform = createTransformChannel(graph)

    const first = await transform.call(ctx(), 'beginTransform', {
      ids: ['test:rect'],
      operation: 'move',
    })
    await transform.call(ctx(), 'cancelTransform', first.sessionId)

    const second = await transform.call(ctx(), 'beginTransform', {
      ids: ['test:rect'],
      operation: 'move',
    })
    expect(second.sessionId).not.toBe(first.sessionId)

    await expect(
      Promise.resolve().then(() =>
        transform.call(ctx(), 'commitTransform', first.sessionId)
      )
    ).rejects.toThrow('Unknown transform session')

    await transform.call(ctx(), 'updateTransform', {
      sessionId: second.sessionId,
      operation: { kind: 'move-by', delta: [15, 5] },
    })
    await transform.call(ctx(), 'commitTransform', second.sessionId)

    expect(cursor.x).toBe(15)
    expect(cursor.y).toBe(5)
  })

  it('rejects legacy transform updates that do not match the frozen session ids', async () => {
    const graph = new SceneGraph()
    const firstIndex = graph.createNode(NodeType.RECTANGLE, 'test:first')
    const secondIndex = graph.createNode(NodeType.RECTANGLE, 'test:second')
    const first = new NodeCursor(graph, firstIndex)
    const second = new NodeCursor(graph, secondIndex)

    const transform = createTransformChannel(graph)

    await transform.call(ctx(), 'beginTransform', ['test:first'], 'Drag Layer')
    await expect(
      Promise.resolve().then(() =>
        transform.call(ctx(), 'moveBy$', ['test:second'], [10, 0])
      )
    ).rejects.toThrow('do not match active transform session ids')
    await transform.call(ctx(), 'cancelTransform')

    expect(first.x).toBe(0)
    expect(second.x).toBe(0)
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

  it('renames nodes through worker-owned history', async () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    cursor.name = 'Before'
    const gate = createMutationGate(graph)
    const node = createNodeChannel(graph, gate)
    const undoRedo = fromService(new UndoRedoService(createContext(graph)), {
      channelName: Channels.UndoRedo,
      mutationGate: gate,
    })

    await node.call(ctx(), 'setName', 'test:rect', 'After')

    expect(cursor.name).toBe('After')
    expect(await undoRedo.call(ctx(), 'undo')).toBe(true)
    expect(cursor.name).toBe('Before')
    expect(await undoRedo.call(ctx(), 'redo')).toBe(true)
    expect(cursor.name).toBe('After')
  })

  it('creates and appends rectangles as one worker-owned history step', async () => {
    const graph = new SceneGraph()
    const page = graph.createNode(NodeType.CANVAS, 'test:page')
    graph.appendChild(0, page)
    const gate = createMutationGate(graph)
    const node = createNodeChannel(graph, gate)
    const undoRedo = fromService(new UndoRedoService(createContext(graph)), {
      channelName: Channels.UndoRedo,
      mutationGate: gate,
    })

    const id = await node.call(ctx(), 'createRectangle', 'test:page', {
      id: 'test:rect',
      x: 10,
      y: 20,
      width: 120,
      height: 80,
    })
    const index = graph.getIndex('test:rect')
    const cursor = new NodeCursor(graph, index)

    expect(id).toBe('test:rect')
    expect(index).not.toBe(NULL_INDEX)
    expect(graph.parent[index]).toBe(page)
    expect(cursor.x).toBe(10)
    expect(cursor.y).toBe(20)
    expect(cursor.width).toBe(120)
    expect(cursor.height).toBe(80)

    expect(await undoRedo.call(ctx(), 'undo')).toBe(true)
    expect(graph.getIndex('test:rect')).toBe(NULL_INDEX)
    expect(await undoRedo.call(ctx(), 'canUndo')).toBe(false)

    expect(await undoRedo.call(ctx(), 'redo')).toBe(true)
    const restored = graph.getIndex('test:rect')
    expect(restored).toBe(index)
    expect(graph.parent[restored]).toBe(page)
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
