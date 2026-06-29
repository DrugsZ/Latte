import {
  Camera,
  PaintStyle,
  RenderCommandType,
  type RenderLayerEncodeContext,
  type RenderLayerHitTestContext,
} from '@latte-js/art'
import { SceneGraph } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import {
  CreationPreviewLayer,
  CREATION_PREVIEW_LAYER_ID,
} from '../creationPreviewLayer'
import {
  CreationPreviewStore,
  CreationPreviewType,
} from '../creationPreviewState'

const createFixture = () => {
  const graph = new SceneGraph()
  const camera = new Camera(200, 200)
  const preview = new CreationPreviewStore()
  const layer = new CreationPreviewLayer(preview)
  return { graph, camera, preview, layer }
}

const createEncodeContext = (
  fixture: ReturnType<typeof createFixture>
): RenderLayerEncodeContext => ({
  sceneGraph: fixture.graph,
  camera: fixture.camera,
  backendSize: { width: 200, height: 200, dpr: 1 },
  reasons: [],
  activeRootId: 'test:page',
})

const createHitTestContext = (
  fixture: ReturnType<typeof createFixture>
): RenderLayerHitTestContext => ({
  sceneGraph: fixture.graph,
  camera: fixture.camera,
  activeRootId: 'test:page',
})

describe('CreationPreviewLayer', () => {
  it('does not encode commands without preview state', () => {
    const fixture = createFixture()

    expect(fixture.layer.id).toBe(CREATION_PREVIEW_LAYER_ID)
    expect(fixture.layer.encode(createEncodeContext(fixture))).toBeNull()
  })

  it('encodes rectangle preview commands without clearing the pass', () => {
    const fixture = createFixture()
    fixture.preview.set({
      type: CreationPreviewType.Rectangle,
      bounds: {
        minX: 10,
        minY: 20,
        maxX: 110,
        maxY: 70,
      },
    })

    const buffer = fixture.layer.encode(createEncodeContext(fixture))!

    expect(buffer.pass.clear).toBeUndefined()
    expect(buffer.commands).toHaveLength(2)
    expect(buffer.commands[0]).toMatchObject({
      type: RenderCommandType.DrawRect,
      x: 110,
      y: 120,
      width: 100,
      height: 50,
      paint: {
        style: PaintStyle.Fill,
      },
    })
    expect(buffer.commands[1]).toMatchObject({
      type: RenderCommandType.DrawRect,
      paint: {
        style: PaintStyle.Stroke,
      },
    })
  })

  it('does not participate in hit-testing', () => {
    const fixture = createFixture()

    expect(
      fixture.layer.hitTest(
        {
          viewport: { x: 110, y: 120 },
          world: { x: 10, y: 20 },
        },
        createHitTestContext(fixture)
      )
    ).toBeNull()
  })
})
