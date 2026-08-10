import { SceneGraph } from '@latte-js/espresso'
import { EditorHost, LatteDocument } from '@latte-js/syrup'
import { describe, expect, it, vi } from 'vitest'

import { EditorRuntime } from '../editorRuntime'

describe('EditorRuntime', () => {
  it('cancels an active transform interaction before switching documents', () => {
    const host = new EditorHost(new SceneGraph())
    const runtime = new EditorRuntime(host)
    const docA = new LatteDocument('doc:a', 'latte://a', new SceneGraph())
    const docB = new LatteDocument('doc:b', 'latte://b', new SceneGraph())
    const setTargetSession = vi.fn()
    const cancelTransform = vi.fn().mockResolvedValue(undefined)
    host.addDocument(docA)
    host.addDocument(docB)
    host.setActiveDocument(docB)
    ;(runtime as any)._baristaClient = { setTargetSession }
    ;(runtime as any)._transformInteraction = {
      isActive: true,
      cancelTransform,
    }

    runtime.setActiveDocument('doc:a')

    expect(cancelTransform).toHaveBeenCalledTimes(1)
    expect(setTargetSession).toHaveBeenCalledWith('doc:a')
    expect(host.activeDocument).toBe(docA)
  })
})
