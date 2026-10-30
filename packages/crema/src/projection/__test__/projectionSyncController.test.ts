import { NodeType } from '@latte-js/bean'
import { MutationScopeKind, NodeCursor, SceneGraph } from '@latte-js/espresso'
import { EditorHost, LatteDocument } from '@latte-js/syrup'
import { describe, expect, it, vi } from 'vitest'

import { ProjectionSyncController } from '../projectionSyncController'

import type {
  IDType,
  INodeLifecycleEvent,
  ISceneDirtyPayload,
} from '@latte-js/bean'

const createHarness = () => {
  const editor = new EditorHost(new SceneGraph())
  const requestRender = vi.fn()
  const disposables: ReturnType<typeof vi.fn>[] = []
  const createListeners: {
    sessionId: string | null
    listener: (event: INodeLifecycleEvent) => void
  }[] = []
  const deleteListeners: {
    sessionId: string | null
    listener: (event: INodeLifecycleEvent) => void
  }[] = []
  const dirtyListeners: {
    sessionId: string | null
    listener: (payload: IDType[] | Partial<ISceneDirtyPayload>) => void
  }[] = []

  const createDisposable = () => {
    const dispose = vi.fn()
    disposables.push(dispose)
    return { dispose }
  }

  const services = {
    getNodeService: vi.fn((sessionId: string | null) => ({
      onDidCreateNode: (listener: (event: INodeLifecycleEvent) => void) => {
        createListeners.push({ sessionId, listener })
        return createDisposable()
      },
      onDidDeleteNode: (listener: (event: INodeLifecycleEvent) => void) => {
        deleteListeners.push({ sessionId, listener })
        return createDisposable()
      },
      onDidMoveNode: vi.fn(),
    })),
    getSceneService: vi.fn((sessionId: string | null) => ({
      onDirty: (
        listener: (payload: IDType[] | Partial<ISceneDirtyPayload>) => void
      ) => {
        dirtyListeners.push({ sessionId, listener })
        return createDisposable()
      },
    })),
  }
  editor.setRenderer({
    setGraph: vi.fn(),
    fitToContent: vi.fn().mockReturnValue(true),
    requestRender,
  })

  return {
    editor,
    requestRender,
    disposables,
    createListeners,
    deleteListeners,
    dirtyListeners,
    services,
    projection: new ProjectionSyncController(editor, services as any),
  }
}

describe('ProjectionSyncController', () => {
  it('notifies UI consumers only after projection maps and version are updated', () => {
    const { editor, projection } = createHarness()
    const graph = editor.graph
    projection.protectGraph(graph)
    const worker = new SceneGraph(
      graph.buffer,
      graph.allocator.buffer,
      graph.heap.buffer
    )
    const index = worker.createNode(NodeType.RECTANGLE, 'test:rect')
    const changes: { index: number; version: number }[] = []
    projection.onDidChange(() => {
      changes.push({
        index: graph.getIndex('test:rect'),
        version: projection.version,
      })
    })
    projection.applyCreated([['test:rect', index]])
    projection.markDirty(['test:rect'])
    projection.applyDeleted([['test:rect', index]])
    projection.applyLoadedDocument(new Map([['test:rect', index]]), graph)

    expect(changes).toEqual([
      { index, version: 1 },
      { index, version: 2 },
      { index: -1, version: 3 },
      { index, version: 4 },
    ])
  })

  it('rejects main-thread cursor and structural writes on a protected projection', () => {
    const { editor, projection } = createHarness()
    const graph = editor.graph
    const index = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const cursor = new NodeCursor(graph, index)
    projection.protectGraph(graph)
    projection.protectGraph(graph)

    expect(graph.mutationGuardEnabled).toBe(true)
    expect(() => {
      cursor.x = 20
    }).toThrow('Mutation outside permitted scope')
    expect(() => graph.createNode(NodeType.RECTANGLE, 'test:other')).toThrow(
      'Mutation outside permitted scope'
    )
    expect(() => graph.registerIdMap('test:other', index)).toThrow(
      'Mutation outside permitted scope'
    )
    expect(() => graph.createMutationAuthority('untrusted')).toThrow(
      'Cannot create mutation authority'
    )
    expect(() =>
      graph.runWithMutationScope({ kind: MutationScopeKind.Manual }, () => {
        cursor.y = 30
      })
    ).toThrow('Invalid mutation authority')
    expect(cursor.x).toBe(0)
    expect(cursor.y).toBe(0)
  })

  it('keeps worker shared-buffer writes operational and scopes only projection ID-map synchronization', () => {
    const { editor, projection } = createHarness()
    const graph = editor.graph
    projection.protectGraph(graph)
    const workerGraph = new SceneGraph(
      graph.buffer,
      graph.allocator.buffer,
      graph.heap.buffer
    )
    const index = workerGraph.createNode(NodeType.RECTANGLE, 'test:rect')
    const workerCursor = new NodeCursor(workerGraph, index)
    workerCursor.x = 64
    workerCursor.name = 'Worker rectangle'

    expect(graph.getIndex('test:rect')).toBe(-1)
    projection.applyCreated([['test:rect', index]])
    const projectionCursor = new NodeCursor(graph, graph.getIndex('test:rect'))
    expect(projectionCursor.x).toBe(64)
    expect(projectionCursor.name).toBe('Worker rectangle')
    expect(() => {
      projectionCursor.x = 80
    }).toThrow('Mutation outside permitted scope')

    projection.applyLoadedDocument(new Map([['test:rect', index]]), graph)
    expect(graph.getIndex('test:rect')).toBe(index)
    projection.applyDeleted([['test:rect', index]])
    expect(graph.getIndex('test:rect')).toBe(-1)
    expect(() => projection.applyCreated([['test:invalid', -1]])).toThrow(
      'Invalid node index'
    )
    expect(graph.activeMutationScope).toBeNull()
    expect(() => graph.resetUUIDMap(new Map())).toThrow(
      'Mutation outside permitted scope'
    )
  })

  it('protects inactive document graphs independently', () => {
    const { editor, projection } = createHarness()
    const inactive = new SceneGraph()
    projection.protectGraph(editor.graph)
    projection.protectGraph(inactive)

    projection.applyLoadedDocument(new Map([['test:doc', 0]]), inactive)

    expect(inactive.getIndex('test:doc')).toBe(0)
    expect(editor.graph.getIndex('test:doc')).toBe(-1)
    expect(inactive.activeMutationScope).toBeNull()
    expect(() => inactive.createNode(NodeType.RECTANGLE, 'test:other')).toThrow(
      'Mutation outside permitted scope'
    )
  })

  it('syncs created and deleted node id maps onto the active editor graph', () => {
    const { editor, projection, createListeners, deleteListeners } =
      createHarness()
    const index = editor.graph.createNode(NodeType.RECTANGLE, 'test:rect')

    projection.start()
    createListeners[0].listener({ nodes: [['test:rect', index]] })

    expect(editor.graph.getIndex('test:rect')).toBe(index)
    expect(projection.version).toBe(1)

    deleteListeners[0].listener({ nodes: [['test:rect', index]] })

    expect(editor.graph.getIndex('test:rect')).toBe(-1)
    expect(projection.version).toBe(2)
  })

  it('tracks render and affected dirty ids and emits dirty events', () => {
    const { projection, requestRender, dirtyListeners } = createHarness()
    const dirtyEvents: unknown[] = []

    projection.start()
    projection.onDidMarkDirty(event => {
      dirtyEvents.push(event)
    })
    dirtyListeners[0].listener({
      version: 1,
      ids: ['test:rect'],
      renderIds: ['test:rect'],
      allIds: ['test:rect'],
      nodes: [{ id: 'test:rect', flags: 1 }],
    })

    expect(projection.renderDirtyIds).toEqual(['test:rect'])
    expect(projection.affectedDirtyIds).toEqual(['test:rect'])
    expect(projection.dirtyNodes).toEqual([{ id: 'test:rect', flags: 1 }])
    expect(projection.version).toBe(1)
    expect(dirtyEvents).toEqual([
      {
        renderIds: ['test:rect'],
        affectedIds: ['test:rect'],
        nodes: [{ id: 'test:rect', flags: 1 }],
      },
    ])
    expect(requestRender).not.toHaveBeenCalled()
  })

  it('keeps projection version for non-render dirty payloads without rendering', () => {
    const { projection, requestRender, dirtyListeners } = createHarness()
    const dirtyEvents: unknown[] = []

    projection.start()
    projection.onDidMarkDirty(event => {
      dirtyEvents.push(event)
    })
    dirtyListeners[0].listener({
      version: 1,
      ids: [],
      renderIds: [],
      allIds: ['test:rect'],
      nodes: [{ id: 'test:rect', flags: 32 }],
    })

    expect(projection.renderDirtyIds).toEqual([])
    expect(projection.affectedDirtyIds).toEqual(['test:rect'])
    expect(projection.version).toBe(1)
    expect(dirtyEvents).toEqual([
      {
        renderIds: [],
        affectedIds: ['test:rect'],
        nodes: [{ id: 'test:rect', flags: 32 }],
      },
    ])
    expect(requestRender).not.toHaveBeenCalled()
  })

  it('applies loaded document id maps and advances projection version', () => {
    const { editor, projection, requestRender } = createHarness()
    const idMap = new Map<IDType, number>([['test:doc', 0]])
    expect(projection.applyLoadedDocument(idMap, editor.graph)).toEqual({
      idMap,
    })
    expect(editor.graph.getIndex('test:doc')).toBe(0)
    expect(requestRender).not.toHaveBeenCalled()
    expect(projection.version).toBe(1)
  })

  it('applies loaded document id maps to an explicit inactive graph without rendering', () => {
    const { editor, projection, requestRender } = createHarness()
    const graph = new SceneGraph()
    const idMap = new Map<IDType, number>([['test:doc', 0]])

    projection.applyLoadedDocument(idMap, graph)

    expect(graph.getIndex('test:doc')).toBe(0)
    expect(editor.graph.getIndex('test:doc')).toBe(-1)
    expect(requestRender).not.toHaveBeenCalled()
    expect(projection.version).toBe(1)
  })

  it('disposes registered worker projection listeners', () => {
    const { projection, disposables } = createHarness()

    projection.start()
    const workerDisposables = [...disposables]
    projection.dispose()

    workerDisposables.forEach(dispose => {
      expect(dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('rebinds worker listeners when the active document changes', () => {
    const { editor, projection, createListeners, disposables, services } =
      createHarness()
    const doc = new LatteDocument('doc:a', 'latte://doc-a', new SceneGraph())

    projection.start()
    expect(services.getNodeService).toHaveBeenLastCalledWith(null)

    editor.addDocument(doc)

    expect(disposables[0]).toHaveBeenCalledTimes(1)
    expect(disposables[1]).toHaveBeenCalledTimes(1)
    expect(disposables[2]).toHaveBeenCalledTimes(1)
    expect(services.getNodeService).toHaveBeenLastCalledWith('doc:a')
    expect(createListeners.map(entry => entry.sessionId)).toEqual([
      null,
      'doc:a',
    ])
  })
})
