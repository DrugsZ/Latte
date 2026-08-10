import { NodeType } from '@latte-js/bean'
import { SceneGraph } from '@latte-js/espresso'
import { Emitter } from '@latte-js/kit'
import { EditorHost, LatteDocument } from '@latte-js/syrup'
import { describe, expect, it, vi } from 'vitest'

import { PageService } from '../pageService'

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('PageService', () => {
  it('rebinds to the active document and ignores stale page queries', async () => {
    const editor = new EditorHost(new SceneGraph())
    const docA = new LatteDocument('doc:a', 'latte://a', new SceneGraph())
    const docB = new LatteDocument('doc:b', 'latte://b', new SceneGraph())
    const loads = new Map([
      ['doc:a', new Emitter<Map<string, number>>()],
      ['doc:b', new Emitter<Map<string, number>>()],
    ])
    let resolveA: (ids: string[]) => void = () => {}
    const queryA = vi.fn(
      () => new Promise<string[]>(resolve => (resolveA = resolve))
    )
    const queryB = vi.fn(async () => ['page:b'])
    const service = new PageService({
      editor,
      getDocumentService: sessionId =>
        ({ onLoad: loads.get(sessionId)!.event }) as any,
      getQueryService: sessionId =>
        ({
          getElementsByType: sessionId === 'doc:a' ? queryA : queryB,
        }) as any,
    })

    editor.addDocument(docA)
    editor.addDocument(docB)
    await flush()

    expect(queryA).toHaveBeenCalledWith(NodeType.CANVAS)
    expect(queryB).toHaveBeenCalledWith(NodeType.CANVAS)
    expect(service.activePageId).toBe('page:b')

    resolveA(['page:a'])
    await flush()
    expect(service.activePageId).toBe('page:b')

    loads.get('doc:b')!.fire(new Map())
    await flush()
    expect(queryB).toHaveBeenCalledTimes(2)

    service.dispose()
  })
})
