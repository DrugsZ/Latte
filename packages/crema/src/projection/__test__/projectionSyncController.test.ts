import { Channels, NodeType } from '@latte-js/bean'
import { Editor } from '@latte-js/syrup'
import { describe, expect, it, vi } from 'vitest'

import { ProjectionSyncController } from '../projectionSyncController'

import type { IDType, ILatteFile, ISceneDirtyPayload } from '@latte-js/bean'

const createHarness = () => {
  const editor = new Editor()
  const requestRender = vi.fn()
  const disposables = [vi.fn(), vi.fn(), vi.fn()]
  const createListeners: ((nodes: [IDType, number][]) => void)[] = []
  const deleteListeners: ((nodes: [IDType, number][]) => void)[] = []
  const dirtyListeners: ((
    payload: IDType[] | Partial<ISceneDirtyPayload>
  ) => void)[] = []

  const nodeService = {
    onCreate: vi.fn((listener: (nodes: [IDType, number][]) => void) => {
      createListeners.push(listener)
      return { dispose: disposables[0] }
    }),
    onDelete: vi.fn((listener: (nodes: [IDType, number][]) => void) => {
      deleteListeners.push(listener)
      return { dispose: disposables[1] }
    }),
  }
  const sceneService = {
    onDirty: vi.fn(
      (listener: (payload: IDType[] | Partial<ISceneDirtyPayload>) => void) => {
        dirtyListeners.push(listener)
        return { dispose: disposables[2] }
      }
    ),
  }
  const baristaClient = {
    getService: vi.fn((channel: Channels) => {
      if (channel === Channels.Node) {
        return nodeService
      }
      if (channel === Channels.Scene) {
        return sceneService
      }
      throw new Error(`Unexpected channel ${channel}`)
    }),
  }

  ;(editor as any)._renderer = { requestRender }
  ;(editor as any)._baristaClient = baristaClient

  return {
    editor,
    requestRender,
    disposables,
    createListeners,
    deleteListeners,
    dirtyListeners,
    projection: new ProjectionSyncController(editor),
  }
}

describe('ProjectionSyncController', () => {
  it('syncs created and deleted node id maps onto the active editor graph', () => {
    const { editor, projection, createListeners, deleteListeners } =
      createHarness()
    const index = editor.graph.createNode(NodeType.RECTANGLE, 'test:rect')

    projection.start()
    createListeners[0]([['test:rect', index]])

    expect(editor.graph.getIndex('test:rect')).toBe(index)
    expect(projection.version).toBe(1)

    deleteListeners[0]([['test:rect', index]])

    expect(editor.graph.getIndex('test:rect')).toBe(-1)
    expect(projection.version).toBe(2)
  })

  it('tracks dirty ids and requests a render for projection updates', () => {
    const { projection, requestRender, dirtyListeners } = createHarness()

    projection.start()
    dirtyListeners[0]({
      version: 1,
      ids: ['test:rect'],
      renderIds: ['test:rect'],
      allIds: ['test:rect'],
      nodes: [{ id: 'test:rect', flags: 1 }],
    })

    expect(projection.dirtyIds).toEqual(['test:rect'])
    expect(projection.allDirtyIds).toEqual(['test:rect'])
    expect(projection.dirtyNodes).toEqual([{ id: 'test:rect', flags: 1 }])
    expect(projection.version).toBe(1)
    expect(requestRender).toHaveBeenCalledTimes(1)
  })

  it('keeps projection version for non-render dirty payloads without rendering', () => {
    const { projection, requestRender, dirtyListeners } = createHarness()

    projection.start()
    dirtyListeners[0]({
      version: 1,
      ids: [],
      renderIds: [],
      allIds: ['test:rect'],
      nodes: [{ id: 'test:rect', flags: 32 }],
    })

    expect(projection.dirtyIds).toEqual([])
    expect(projection.allDirtyIds).toEqual(['test:rect'])
    expect(projection.version).toBe(1)
    expect(requestRender).not.toHaveBeenCalled()
  })

  it('hydrates through the editor and advances projection version', () => {
    const { editor, projection } = createHarness()
    const data = { elements: [] } as unknown as ILatteFile
    const idMap = new Map<IDType, number>([['test:doc', 0]])
    const hydrateDocument = vi
      .spyOn(editor, 'hydrateDocument')
      .mockReturnValue({ idMap, activeRootId: undefined })

    expect(projection.hydrateDocument(data, idMap)).toEqual({
      idMap,
      activeRootId: undefined,
    })
    expect(hydrateDocument).toHaveBeenCalledWith(data, idMap)
    expect(projection.version).toBe(1)
  })

  it('disposes registered worker projection listeners', () => {
    const { projection, disposables } = createHarness()

    projection.start()
    projection.dispose()

    disposables.forEach(dispose => {
      expect(dispose).toHaveBeenCalledTimes(1)
    })
  })
})
