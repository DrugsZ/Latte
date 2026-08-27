import { describe, expect, it, vi } from 'vitest'

import { EditorHost } from '../editorHost'
import { LatteDocument } from '../document'

describe('EditorHost', () => {
  it('restores the default graph when the active document is cleared', () => {
    const defaultGraph = { id: 'default' }
    const documentGraph = { id: 'document' }
    const host = new EditorHost(defaultGraph)
    const renderer = {
      setGraph: vi.fn(),
      fitToContent: vi.fn().mockReturnValue(true),
      requestRender: vi.fn(),
    }

    host.setRenderer(renderer)
    host.addDocument(new LatteDocument('doc:a', 'latte://doc-a', documentGraph))
    host.setActiveDocument(null)

    expect(host.graph).toBe(defaultGraph)
    expect(renderer.setGraph).toHaveBeenLastCalledWith(defaultGraph)
  })
})
