import { RenderReason } from '@latte-js/art'
import { NodeType } from '@latte-js/bean'
import { SceneGraph } from '@latte-js/espresso'
import { EditorHost, LatteDocument } from '@latte-js/syrup'
import { describe, expect, it, vi } from 'vitest'

import { DocumentViewStateController } from '../documentViewStateController'

import type { ILatteFile } from '@latte-js/bean'
import type { IRenderViewStateSink } from '../documentViewStateController'

const createData = (): ILatteFile =>
  ({
    elements: [
      {
        guid: 'test:document',
        type: NodeType.DOCUMENT,
      },
      {
        guid: 'test:page',
        type: NodeType.CANVAS,
      },
    ],
  }) as unknown as ILatteFile

const createRenderViewState = () => ({
  setActiveRootId: vi.fn<IRenderViewStateSink['setActiveRootId']>(),
  fitToContent: vi
    .fn<IRenderViewStateSink['fitToContent']>()
    .mockReturnValue(true),
  requestRender: vi.fn<IRenderViewStateSink['requestRender']>(),
})

describe('DocumentViewStateController', () => {
  it('stores loaded document active root and fits the active document', () => {
    const editor = new EditorHost(new SceneGraph())
    const renderViewState = createRenderViewState()
    const doc = new LatteDocument('doc:a', 'latte://a', new SceneGraph())
    editor.addDocument(doc)
    const controller = new DocumentViewStateController(editor, renderViewState)

    const activeRootId = controller.applyLoadedDocument(doc.id, createData(), {
      fitToContent: true,
    })

    expect(activeRootId).toBe('test:page')
    expect(controller.getActiveRootId(doc.id)).toBe('test:page')
    expect(renderViewState.setActiveRootId).toHaveBeenCalledWith('test:page')
    expect(renderViewState.fitToContent).toHaveBeenCalledWith('test:page')
    expect(renderViewState.requestRender).toHaveBeenCalledWith(
      RenderReason.ActiveRootChanged
    )
  })

  it('restores the active root when switching back to a document', () => {
    const editor = new EditorHost(new SceneGraph())
    const renderViewState = createRenderViewState()
    const controller = new DocumentViewStateController(editor, renderViewState)
    const docA = new LatteDocument('doc:a', 'latte://a', new SceneGraph())
    const docB = new LatteDocument('doc:b', 'latte://b', new SceneGraph())

    editor.addDocument(docA)
    controller.setActiveRootId(docA.id, 'test:page-a')
    editor.addDocument(docB)
    controller.setActiveRootId(docB.id, 'test:page-b')
    renderViewState.setActiveRootId.mockClear()
    renderViewState.requestRender.mockClear()

    editor.setActiveDocument(docA)

    expect(renderViewState.setActiveRootId).toHaveBeenCalledWith('test:page-a')
    expect(renderViewState.requestRender).toHaveBeenCalledTimes(1)
  })

  it('stops applying view state after dispose', () => {
    const editor = new EditorHost(new SceneGraph())
    const renderViewState = createRenderViewState()
    const controller = new DocumentViewStateController(editor, renderViewState)
    const doc = new LatteDocument('doc:a', 'latte://a', new SceneGraph())

    controller.setActiveRootId(doc.id, 'test:page')
    controller.dispose()
    renderViewState.setActiveRootId.mockClear()
    editor.addDocument(doc)

    expect(renderViewState.setActiveRootId).not.toHaveBeenCalled()
    expect(controller.getActiveRootId(doc.id)).toBeUndefined()
  })

  it('clears the renderer active root when the active document has no root', () => {
    const editor = new EditorHost(new SceneGraph())
    const renderViewState = createRenderViewState()
    const controller = new DocumentViewStateController(editor, renderViewState)
    const doc = new LatteDocument('doc:a', 'latte://a', new SceneGraph())

    editor.addDocument(doc)
    renderViewState.setActiveRootId.mockClear()
    renderViewState.requestRender.mockClear()
    controller.applyActiveRoot(doc.id)

    expect(renderViewState.setActiveRootId).toHaveBeenCalledWith(undefined)
    expect(renderViewState.fitToContent).not.toHaveBeenCalled()
    expect(renderViewState.requestRender).toHaveBeenCalledWith(
      RenderReason.ActiveRootChanged
    )
  })

  it('clears the renderer active root when there is no active document', () => {
    const editor = new EditorHost(new SceneGraph())
    const renderViewState = createRenderViewState()
    const controller = new DocumentViewStateController(editor, renderViewState)
    const doc = new LatteDocument('doc:a', 'latte://a', new SceneGraph())

    editor.addDocument(doc)
    controller.setActiveRootId(doc.id, 'test:page')
    renderViewState.setActiveRootId.mockClear()
    renderViewState.requestRender.mockClear()

    editor.setActiveDocument(null)

    expect(renderViewState.setActiveRootId).toHaveBeenCalledWith(undefined)
    expect(renderViewState.requestRender).toHaveBeenCalledWith(
      RenderReason.ActiveRootChanged
    )
  })
})
