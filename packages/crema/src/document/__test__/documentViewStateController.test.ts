import { NodeType } from '@latte-js/bean'
import { SceneGraph } from '@latte-js/espresso'
import { EditorHost, LatteDocument } from '@latte-js/syrup'
import { describe, expect, it, vi } from 'vitest'

import { DocumentViewStateController } from '../documentViewStateController'

import type { ILatteFile } from '@latte-js/bean'

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

const createRenderer = () => ({
  setGraph: vi.fn(),
  setActiveRootId: vi.fn(),
  fitToContent: vi.fn().mockReturnValue(true),
  requestRender: vi.fn(),
})

describe('DocumentViewStateController', () => {
  it('stores loaded document active root and fits the active document', () => {
    const editor = new EditorHost(new SceneGraph())
    const renderer = createRenderer()
    editor.setRenderer(renderer)
    const doc = new LatteDocument('doc:a', 'latte://a', new SceneGraph())
    editor.addDocument(doc)
    const controller = new DocumentViewStateController(editor)

    const activeRootId = controller.applyLoadedDocument(doc.id, createData(), {
      fitToContent: true,
    })

    expect(activeRootId).toBe('test:page')
    expect(controller.getActiveRootId(doc.id)).toBe('test:page')
    expect(renderer.setActiveRootId).toHaveBeenCalledWith('test:page')
    expect(renderer.fitToContent).toHaveBeenCalledWith('test:page')
    expect(renderer.requestRender).not.toHaveBeenCalled()
  })

  it('restores the active root when switching back to a document', () => {
    const editor = new EditorHost(new SceneGraph())
    const renderer = createRenderer()
    editor.setRenderer(renderer)
    const controller = new DocumentViewStateController(editor)
    const docA = new LatteDocument('doc:a', 'latte://a', new SceneGraph())
    const docB = new LatteDocument('doc:b', 'latte://b', new SceneGraph())

    editor.addDocument(docA)
    controller.setActiveRootId(docA.id, 'test:page-a')
    editor.addDocument(docB)
    controller.setActiveRootId(docB.id, 'test:page-b')
    renderer.setActiveRootId.mockClear()
    renderer.requestRender.mockClear()

    editor.setActiveDocument(docA)

    expect(renderer.setActiveRootId).toHaveBeenCalledWith('test:page-a')
    expect(renderer.requestRender).toHaveBeenCalledTimes(1)
  })

  it('stops applying view state after dispose', () => {
    const editor = new EditorHost(new SceneGraph())
    const renderer = createRenderer()
    editor.setRenderer(renderer)
    const controller = new DocumentViewStateController(editor)
    const doc = new LatteDocument('doc:a', 'latte://a', new SceneGraph())

    controller.setActiveRootId(doc.id, 'test:page')
    controller.dispose()
    renderer.setActiveRootId.mockClear()
    editor.addDocument(doc)

    expect(renderer.setActiveRootId).not.toHaveBeenCalled()
    expect(controller.getActiveRootId(doc.id)).toBeUndefined()
  })

  it('clears the renderer active root when the active document has no root', () => {
    const editor = new EditorHost(new SceneGraph())
    const renderer = createRenderer()
    editor.setRenderer(renderer)
    const controller = new DocumentViewStateController(editor)
    const doc = new LatteDocument('doc:a', 'latte://a', new SceneGraph())

    editor.addDocument(doc)
    renderer.setActiveRootId.mockClear()
    controller.applyActiveRoot(doc.id)

    expect(renderer.setActiveRootId).toHaveBeenCalledWith(undefined)
    expect(renderer.fitToContent).not.toHaveBeenCalled()
    expect(renderer.requestRender).not.toHaveBeenCalled()
  })
})
