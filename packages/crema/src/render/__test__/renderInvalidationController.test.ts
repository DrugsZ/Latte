import { SceneGraph } from '@latte-js/espresso'
import { Emitter } from '@latte-js/kit'
import { EditorHost } from '@latte-js/syrup'
import { describe, expect, it, vi } from 'vitest'

import { RenderInvalidationController } from '../renderInvalidationController'

import type { IProjectionDirtyEvent } from '../../projection/projectionSyncController'

const createHarness = () => {
  const editor = new EditorHost(new SceneGraph())
  const requestRender = vi.fn()
  const dirty = new Emitter<IProjectionDirtyEvent>()

  editor.setRenderer({
    setGraph: vi.fn(),
    setActiveRootId: vi.fn(),
    fitToContent: vi.fn().mockReturnValue(true),
    requestRender,
  })

  const controller = new RenderInvalidationController(editor, {
    onDidMarkDirty: dirty.event,
  })

  return { controller, dirty, requestRender }
}

describe('RenderInvalidationController', () => {
  it('requests render when projection reports render dirty ids', () => {
    const { dirty, requestRender } = createHarness()

    dirty.fire({
      renderIds: ['test:rect'],
      affectedIds: ['test:rect'],
      nodes: [],
    })

    expect(requestRender).toHaveBeenCalledTimes(1)
  })

  it('does not render for non-render projection changes', () => {
    const { dirty, requestRender } = createHarness()

    dirty.fire({
      renderIds: [],
      affectedIds: ['test:rect'],
      nodes: [],
    })

    expect(requestRender).not.toHaveBeenCalled()
  })

  it('stops listening after dispose', () => {
    const { controller, dirty, requestRender } = createHarness()

    controller.dispose()
    dirty.fire({
      renderIds: ['test:rect'],
      affectedIds: ['test:rect'],
      nodes: [],
    })

    expect(requestRender).not.toHaveBeenCalled()
  })
})
