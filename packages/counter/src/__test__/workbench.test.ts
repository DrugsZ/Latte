import { RenderReason } from '@latte-js/art'
import { SceneGraph } from '@latte-js/espresso'
import { EditorHost } from '@latte-js/syrup'
import { describe, expect, it, vi } from 'vitest'

import { CreationToolId } from '../contrib/create/rectangleTool'
import { SELECTION_OVERLAY_INTERACTION_TOOL_ID } from '../interactions/selectionOverlayInteractionTypes'
import { CREATION_PREVIEW_LAYER_ID } from '../overlay/creationPreviewLayer'
import { CreationPreviewType } from '../overlay/creationPreviewState'
import { SELECTION_OVERLAY_LAYER_ID } from '../overlay/selectionOverlayLayer'
import { Workbench } from '../workbench'

const createInputService = () => ({
  onKeyDown: vi.fn(),
  onKeyUp: vi.fn(),
  registerHandler: vi.fn(),
  removeHandler: vi.fn(),
  capturePointer: vi.fn(),
  releasePointer: vi.fn(),
})

const createTransformInteraction = () => ({
  isActive: false,
  beginTransform: vi.fn(async () => {}),
  moveBy: vi.fn(),
  resize: vi.fn(),
  resizeByHandle: vi.fn(),
  transformAround: vi.fn(),
  commitTransform: vi.fn(async () => {}),
  cancelTransform: vi.fn(async () => {}),
})

describe('Workbench', () => {
  it('registers creation preview, selection overlay, and invalidates rendering on state changes', () => {
    const inputService = createInputService()
    const layerDisposables = [{ dispose: vi.fn() }, { dispose: vi.fn() }]
    const renderer = {
      registerLayer: vi.fn(() => layerDisposables.shift()!),
      requestRender: vi.fn(),
    }
    const workbench = new Workbench({
      editor: new EditorHost(new SceneGraph()),
      inputService,
      renderer,
      transformInteraction: createTransformInteraction(),
      documentService: {
        onLoad: vi.fn(() => ({ dispose: vi.fn() })),
      } as any,
      nodeService: {
        createRectangle: vi.fn(async () => 'test:rect'),
      } as any,
      queryService: {
        getElementsByType: vi.fn(async () => []),
      } as any,
    })

    expect(renderer.registerLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: CREATION_PREVIEW_LAYER_ID })
    )
    expect(renderer.registerLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: SELECTION_OVERLAY_LAYER_ID })
    )
    expect(inputService.registerHandler).toHaveBeenCalledWith(
      expect.objectContaining({ id: SELECTION_OVERLAY_INTERACTION_TOOL_ID })
    )

    workbench.toolService.activateTool(CreationToolId.Rectangle)
    expect(workbench.toolService.activeTool?.id).toBe(CreationToolId.Rectangle)

    workbench.creationPreviewStore.set({
      type: CreationPreviewType.Rectangle,
      bounds: {
        minX: 0,
        minY: 0,
        maxX: 10,
        maxY: 10,
      },
    })
    workbench.selectionService.select(['test:rect'])

    expect(renderer.requestRender).toHaveBeenCalledWith(
      RenderReason.LayerChanged
    )

    workbench.dispose()

    expect(renderer.registerLayer).toHaveBeenCalledTimes(2)
    expect(
      renderer.registerLayer.mock.results[0].value.dispose
    ).toHaveBeenCalled()
    expect(
      renderer.registerLayer.mock.results[1].value.dispose
    ).toHaveBeenCalled()
    expect(inputService.removeHandler).toHaveBeenCalledWith(
      SELECTION_OVERLAY_INTERACTION_TOOL_ID
    )
  })
})
