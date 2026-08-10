import { BlendModeType, type IDType, type ILatteFile } from '@latte-js/bean'
import { SceneGraph } from '@latte-js/espresso'
import { describe, expect, it, vi } from 'vitest'

import { BaristaSystem } from '../../systems'
import { DocumentService } from '../document'

const createDocument = (pageId: IDType): ILatteFile => ({
  elements: [
    {
      guid: 'test:root',
      type: 'DOCUMENT',
      name: 'Document',
      visible: true,
      opacity: 1,
      blendMode: BlendModeType.NORMAL,
      transform: [1, 0, 0, 1, 0, 0],
      size: { x: 0, y: 0 },
      strokeWeight: 0,
      strokeAlign: 'CENTER',
      strokeJoin: 'MITER',
      strokeStyle: 'SOLID',
      dashCap: 'NONE',
      locked: false,
    },
    {
      guid: pageId,
      parentIndex: { guid: 'test:root', position: '!' },
      type: 'CANVAS',
      name: 'Page',
      visible: true,
      opacity: 1,
      blendMode: BlendModeType.NORMAL,
      transform: [1, 0, 0, 1, 0, 0],
      size: { x: 0, y: 0 },
      strokeWeight: 0,
      strokeAlign: 'CENTER',
      strokeJoin: 'MITER',
      strokeStyle: 'SOLID',
      dashCap: 'NONE',
      locked: false,
      backgrounds: [],
    },
  ],
})

describe('DocumentService', () => {
  it('isolates load and save events by session', async () => {
    const graphA = new SceneGraph()
    const graphB = new SceneGraph()
    let graph = graphA
    let sessionId = 'doc:a'
    const authorities = new WeakMap<
      SceneGraph,
      ReturnType<SceneGraph['createMutationAuthority']>
    >()
    const context = {
      get sceneGraph() {
        return graph
      },
      get currentSessionId() {
        return sessionId
      },
      get mutationAuthority() {
        let authority = authorities.get(graph)
        if (!authority) {
          authority = graph.createMutationAuthority('document-test')
          authorities.set(graph, authority)
        }
        return authority
      },
      accessSystem: null as unknown as BaristaSystem,
      getService: () => {
        throw new Error('getService is not used in document service tests')
      },
    }
    context.accessSystem = new BaristaSystem(context)
    const service = new DocumentService(context)
    const loadA = vi.fn()
    const saveA = vi.fn()
    service.onLoad(loadA)
    service.onSave(saveA)

    graph = graphB
    sessionId = 'doc:b'
    const loadB = vi.fn()
    const saveB = vi.fn()
    service.onLoad(loadB)
    service.onSave(saveB)

    await service.load(createDocument('page:b'))
    await service.save()

    expect(loadA).not.toHaveBeenCalled()
    expect(saveA).not.toHaveBeenCalled()
    expect(loadB).toHaveBeenCalledTimes(1)
    expect(loadB.mock.calls[0][0].get('page:b')).toBe(1)
    expect(saveB).toHaveBeenCalledTimes(1)
  })
})
