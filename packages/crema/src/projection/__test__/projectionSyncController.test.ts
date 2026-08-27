import { NodeType } from '@latte-js/bean'
import { SceneGraph } from '@latte-js/espresso'
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

  return {
    editor,
    disposables,
    createListeners,
    deleteListeners,
    dirtyListeners,
    services,
    projection: new ProjectionSyncController(editor, services as any),
  }
}

describe('ProjectionSyncController', () => {
  it('syncs id maps and emits explicit register and unregister events', () => {
    const { editor, projection, createListeners, deleteListeners } =
      createHarness()
    const index = editor.graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const changes: unknown[] = []

    projection.onDidChangeIdMap(event => changes.push(event))
    projection.start()
    createListeners[0].listener({ nodes: [['test:rect', index]] })

    expect(editor.graph.getIndex('test:rect')).toBe(index)
    expect(projection.version).toBe(0)

    deleteListeners[0].listener({ nodes: [['test:rect', index]] })

    expect(editor.graph.getIndex('test:rect')).toBe(-1)
    expect(projection.version).toBe(0)
    expect(changes).toEqual([
      {
        kind: 'register',
        sessionId: null,
        nodes: [['test:rect', index]],
      },
      {
        kind: 'unregister',
        sessionId: null,
        nodes: [['test:rect', index]],
      },
    ])
  })

  it('uses the worker scene version and emits versioned dirty events', () => {
    const { projection, dirtyListeners } = createHarness()
    const dirtyEvents: unknown[] = []

    projection.start()
    projection.onDidMarkDirty(event => dirtyEvents.push(event))
    dirtyListeners[0].listener({
      version: 7,
      ids: ['test:rect'],
      renderIds: ['test:rect'],
      allIds: ['test:rect'],
      nodes: [{ id: 'test:rect', flags: 1 }],
    })

    expect(projection.renderDirtyIds).toEqual(['test:rect'])
    expect(projection.affectedDirtyIds).toEqual(['test:rect'])
    expect(projection.dirtyNodes).toEqual([{ id: 'test:rect', flags: 1 }])
    expect(projection.version).toBe(7)
    expect(dirtyEvents).toEqual([
      {
        sessionId: null,
        version: 7,
        renderIds: ['test:rect'],
        affectedIds: ['test:rect'],
        nodes: [{ id: 'test:rect', flags: 1 }],
      },
    ])
  })

  it('deduplicates dirty ids and merges flags for repeated nodes', () => {
    const { projection, dirtyListeners } = createHarness()

    projection.start()
    dirtyListeners[0].listener({
      version: 1,
      renderIds: ['test:a', 'test:a'],
      allIds: ['test:a', 'test:b', 'test:b'],
      nodes: [
        { id: 'test:a', flags: 1 },
        { id: 'test:a', flags: 4 },
        { id: 'test:c', flags: 32 },
      ],
    })

    expect(projection.renderDirtyIds).toEqual(['test:a'])
    expect(projection.affectedDirtyIds).toEqual(['test:a', 'test:b', 'test:c'])
    expect(projection.dirtyNodes).toEqual([
      { id: 'test:a', flags: 5 },
      { id: 'test:c', flags: 32 },
    ])
  })

  it('rejects stale or duplicate worker scene versions', () => {
    const { projection, dirtyListeners } = createHarness()
    const dirtyEvents: unknown[] = []

    projection.start()
    projection.onDidMarkDirty(event => dirtyEvents.push(event))
    dirtyListeners[0].listener({ version: 3, renderIds: ['test:a'] })
    dirtyListeners[0].listener({ version: 3, renderIds: ['test:b'] })
    dirtyListeners[0].listener({ version: 2, renderIds: ['test:c'] })

    expect(projection.version).toBe(3)
    expect(projection.renderDirtyIds).toEqual(['test:a'])
    expect(dirtyEvents).toHaveLength(1)
  })

  it('keeps independent versions per document session', () => {
    const { editor, projection, dirtyListeners } = createHarness()
    const doc = new LatteDocument('doc:a', 'latte://doc-a', new SceneGraph())

    projection.start()
    dirtyListeners[0].listener({ version: 4, renderIds: ['kernel:a'] })
    editor.addDocument(doc)

    expect(projection.version).toBe(0)
    expect(projection.renderDirtyIds).toEqual([])

    dirtyListeners[1].listener({ version: 2, renderIds: ['doc:a'] })
    expect(projection.version).toBe(2)

    editor.setActiveDocument(null)
    expect(projection.version).toBe(4)
  })

  it('ignores late callbacks from an unbound document graph', () => {
    const { editor, projection, createListeners, dirtyListeners } =
      createHarness()
    const docA = new LatteDocument('doc:a', 'latte://doc-a', new SceneGraph())
    const docB = new LatteDocument('doc:b', 'latte://doc-b', new SceneGraph())

    projection.start()
    editor.addDocument(docA)
    const staleCreate = createListeners[1].listener
    const staleDirty = dirtyListeners[1].listener
    editor.addDocument(docB)

    staleCreate({ nodes: [['late:a', 3]] })
    staleDirty({ version: 9, renderIds: ['late:a'] })

    expect(docA.graph.getIndex('late:a')).toBe(-1)
    expect(docB.graph.getIndex('late:a')).toBe(-1)
    expect(projection.version).toBe(0)
  })

  it('emits reset events for loaded active and inactive graphs', () => {
    const { editor, projection } = createHarness()
    const doc = new LatteDocument('doc:a', 'latte://doc-a', new SceneGraph())
    const changes: unknown[] = []
    const idMap = new Map<IDType, number>([['test:doc', 0]])

    editor.addDocument(doc, false)
    projection.onDidChangeIdMap(event => changes.push(event))
    expect(projection.applyLoadedDocument(idMap, doc.graph)).toEqual({ idMap })

    expect(doc.graph.getIndex('test:doc')).toBe(0)
    expect(editor.graph.getIndex('test:doc')).toBe(-1)
    expect(projection.version).toBe(0)
    expect(changes).toEqual([
      {
        kind: 'reset',
        sessionId: 'doc:a',
        nodes: [['test:doc', 0]],
      },
    ])
  })

  it('clears the previous dirty snapshot when the active graph is reset', () => {
    const { editor, projection, dirtyListeners } = createHarness()

    projection.start()
    dirtyListeners[0].listener({
      version: 1,
      renderIds: ['test:old'],
      allIds: ['test:old'],
    })
    projection.applyLoadedDocument(new Map([['test:new', 0]]), editor.graph)

    expect(projection.version).toBe(1)
    expect(projection.renderDirtyIds).toEqual([])
    expect(projection.affectedDirtyIds).toEqual([])
    expect(projection.dirtyNodes).toEqual([])
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
