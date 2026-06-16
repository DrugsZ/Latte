import { DIRTY_TREE, SceneGraph } from '@latte-js/espresso'
import { Emitter } from '@latte-js/kit'
import { EditorHost } from '@latte-js/syrup'
import { describe, expect, it, vi } from 'vitest'

import { RenderInvalidationController } from '../renderInvalidationController'

import type { IProjectionDirtyEvent } from '../../projection/projectionSyncController'

const createHarness = () => {
  const editor = new EditorHost(new SceneGraph())
  const requestRender = vi.fn()
  const rebuildSceneIndex = vi.fn()
  const updateSceneIndexByIds = vi.fn()
  const dirty = new Emitter<IProjectionDirtyEvent>()

  editor.setRenderer({
    setGraph: vi.fn(),
    setActiveRootId: vi.fn(),
    rebuildSceneIndex,
    updateSceneIndexByIds,
    fitToContent: vi.fn().mockReturnValue(true),
    requestRender,
  })

  const controller = new RenderInvalidationController(editor, {
    onDidMarkDirty: dirty.event,
  })

  return {
    controller,
    dirty,
    rebuildSceneIndex,
    updateSceneIndexByIds,
    requestRender,
  }
}

describe('RenderInvalidationController', () => {
  it('requests render when projection reports render dirty ids', () => {
    const { dirty, requestRender, updateSceneIndexByIds } = createHarness()

    dirty.fire({
      renderIds: ['test:rect'],
      affectedIds: ['test:rect'],
      nodes: [],
    })

    expect(updateSceneIndexByIds).toHaveBeenCalledWith(['test:rect'])
    expect(requestRender).toHaveBeenCalledTimes(1)
  })

  it('rebuilds the scene index for tree changes before rendering', () => {
    const { dirty, rebuildSceneIndex, updateSceneIndexByIds, requestRender } =
      createHarness()

    dirty.fire({
      renderIds: ['test:rect'],
      affectedIds: ['test:rect'],
      nodes: [{ id: 'test:rect', flags: DIRTY_TREE }],
    })

    expect(rebuildSceneIndex).toHaveBeenCalledTimes(1)
    expect(updateSceneIndexByIds).not.toHaveBeenCalled()
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
