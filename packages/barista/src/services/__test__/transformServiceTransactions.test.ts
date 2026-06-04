import { Channels, NodeType } from '@latte-js/bean'
import { NodeCursor, SceneGraph } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { fromService } from '../../ipc'
import { BaristaSystem } from '../../systems'
import { MutationGate } from '../../transactions/mutationPolicy'
import { TransformService } from '../transform'
import { UndoRedoService } from '../undoRedo'

const createContext = (graph: SceneGraph) => ({
  sceneGraph: graph,
  accessSystem: new BaristaSystem(graph),
  getService: () => {
    throw new Error('getService is not used in transform service tests')
  },
})

describe('TransformService transactions', () => {
  const createTransformChannel = (graph: SceneGraph) => {
    const transform = new TransformService(createContext(graph))
    return fromService(transform, {
      channelName: Channels.Transform,
      mutationGate: new MutationGate(graph),
    })
  }

  const createUndoRedoChannel = (graph: SceneGraph) => {
    const undoRedo = new UndoRedoService(createContext(graph))
    return fromService(undoRedo, {
      channelName: Channels.UndoRedo,
      mutationGate: new MutationGate(graph),
    })
  }

  it('wraps a standalone transform RPC in worker-owned history', async () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    cursor.x = 10
    cursor.y = 20

    const transform = createTransformChannel(graph)
    const undoRedo = createUndoRedoChannel(graph)

    await transform.call('', 'moveBy', ['test:rect'], [5, 7])

    expect(cursor.x).toBe(15)
    expect(cursor.y).toBe(27)
    expect(await undoRedo.call('', 'canUndo')).toBe(true)
    expect(await undoRedo.call('', 'undo')).toBe(true)
    expect(cursor.x).toBe(10)
    expect(cursor.y).toBe(20)

    expect(await undoRedo.call('', 'redo')).toBe(true)
    expect(cursor.x).toBe(15)
    expect(cursor.y).toBe(27)
  })

  it('owns transform interaction commit inside the worker', async () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    cursor.x = 10
    cursor.y = 20

    const gate = new MutationGate(graph)
    const transform = fromService(new TransformService(createContext(graph)), {
      channelName: Channels.Transform,
      mutationGate: gate,
    })
    const undoRedo = fromService(new UndoRedoService(createContext(graph)), {
      channelName: Channels.UndoRedo,
      mutationGate: gate,
    })

    await transform.call('', 'beginTransform', ['test:rect'], 'Drag Layer')
    await transform.call('', 'moveBy$', ['test:rect'], [5, 0])
    await transform.call('', 'moveBy', ['test:rect'], [7, 0])
    await transform.call('', 'commitTransform')

    expect(cursor.x).toBe(17)
    expect(await undoRedo.call('', 'undo')).toBe(true)
    expect(cursor.x).toBe(10)
    expect(await undoRedo.call('', 'redo')).toBe(true)
    expect(cursor.x).toBe(17)
  })

  it('cancels transform interaction edits inside the worker', async () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    cursor.x = 10
    cursor.y = 20

    const transform = createTransformChannel(graph)

    await transform.call('', 'beginTransform', ['test:rect'], 'Drag Layer')
    await transform.call('', 'moveBy$', ['test:rect'], [40, 30])
    await transform.call('', 'cancelTransform')

    expect(cursor.x).toBe(10)
    expect(cursor.y).toBe(20)
  })

  it('rejects transform notifications outside a transform interaction', async () => {
    const graph = new SceneGraph()
    graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const transform = createTransformChannel(graph)

    await expect(
      transform.call('', 'moveBy$', ['test:rect'], [1, 1])
    ).rejects.toThrow('requires an active mutation session')
  })

  it('rejects NodeCursor writes from readonly service calls', async () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    const channel = fromService(
      {
        getMutationPolicy: () => ({ kind: 'readonly' as const }),
        async write() {
          cursor.x = 10
        },
      },
      {
        channelName: 'test',
        mutationGate: new MutationGate(graph),
      }
    )

    await expect(channel.call('', 'write')).rejects.toThrow(
      'Mutation outside permitted scope'
    )
  })

  it('rejects writes from another session while an interaction is active', async () => {
    const graph = new SceneGraph()
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    const gate = new MutationGate(graph)
    const transform = fromService(new TransformService(createContext(graph)), {
      channelName: Channels.Transform,
      mutationGate: gate,
    })

    await transform.call('doc:a', 'beginTransform', ['test:rect'], 'Drag Layer')

    await expect(
      transform.call('doc:b', 'moveBy', ['test:rect'], [10, 0])
    ).rejects.toThrow('while "Drag Layer" is active for doc:a')
    expect(cursor.x).toBe(0)

    await transform.call('doc:a', 'cancelTransform')
  })
})
