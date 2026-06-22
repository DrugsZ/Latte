import { RenderReason } from '@latte-js/art'
import { SceneGraph } from '@latte-js/espresso'
import { EditorHost } from '@latte-js/syrup'
import { describe, expect, it, vi } from 'vitest'

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

describe('Workbench', () => {
  it('registers selection overlay and invalidates rendering on selection change', () => {
    const inputService = createInputService()
    const layerDisposable = { dispose: vi.fn() }
    const renderer = {
      registerLayer: vi.fn(() => layerDisposable),
      requestRender: vi.fn(),
    }
    const workbench = new Workbench({
      editor: new EditorHost(new SceneGraph()),
      inputService,
      renderer,
      documentService: {
        onLoad: vi.fn(() => ({ dispose: vi.fn() })),
      } as any,
      queryService: {
        getElementsByType: vi.fn(async () => []),
      } as any,
    })

    expect(renderer.registerLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: SELECTION_OVERLAY_LAYER_ID })
    )

    workbench.selectionService.select(['test:rect'])

    expect(renderer.requestRender).toHaveBeenCalledWith(
      RenderReason.LayerChanged
    )

    workbench.dispose()

    expect(layerDisposable.dispose).toHaveBeenCalled()
  })
})
