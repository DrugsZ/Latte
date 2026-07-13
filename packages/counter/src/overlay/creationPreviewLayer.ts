import {
  PaintStyle,
  RenderCommandBuffer,
  RenderCommandType,
} from '@latte-js/art'

import type {
  RenderLayer,
  RenderLayerEncodeContext,
  RenderLayerHitResult,
  RenderLayerHitTestContext,
  RenderLayerHitTestPoint,
} from '@latte-js/art'
import type {
  CreationPreviewState,
  CreationPreviewStore,
  WorldBounds,
} from './creationPreviewState'
import type { ViewportRect } from './selectionOverlayGeometry'

export const CREATION_PREVIEW_LAYER_ID = 'latte.creation-preview'

const IDENTITY_TRANSFORM = new Float32Array([1, 0, 0, 1, 0, 0])
const PREVIEW_FILL = 0x2f80ff24
const PREVIEW_STROKE = 0x2f80ffff
const RECTANGLE_PREVIEW_TYPE =
  'rectangle' as NonNullable<CreationPreviewState>['type']

export class CreationPreviewLayer implements RenderLayer {
  public readonly id = CREATION_PREVIEW_LAYER_ID
  public readonly zIndex = 900

  constructor(private readonly _previewStore: CreationPreviewStore) {}

  public encode(context: RenderLayerEncodeContext) {
    const state = this._previewStore.state
    if (!state || state.type !== RECTANGLE_PREVIEW_TYPE) {
      return null
    }

    const bounds = this._normalizeBounds(state.bounds)
    if (!this._intersects(bounds, context.camera.getViewportBounds())) {
      return null
    }

    const viewportBounds = this._worldToViewportBounds(bounds, context)
    const buffer = new RenderCommandBuffer()
    this._drawRect(buffer, viewportBounds, PaintStyle.Fill, PREVIEW_FILL)
    this._drawRect(buffer, viewportBounds, PaintStyle.Stroke, PREVIEW_STROKE)
    return buffer
  }

  public hitTest(
    _point: RenderLayerHitTestPoint,
    _context: RenderLayerHitTestContext
  ): RenderLayerHitResult | null {
    return null
  }

  private _drawRect(
    buffer: RenderCommandBuffer,
    bounds: ViewportRect,
    style: PaintStyle,
    color: number
  ) {
    buffer.push({
      type: RenderCommandType.DrawRect,
      transform: Float32Array.from(IDENTITY_TRANSFORM),
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      cornerRadius: 0,
      paint:
        style === PaintStyle.Stroke
          ? {
              style,
              color,
              stroke: { width: 1 },
            }
          : {
              style,
              color,
            },
    })
  }

  private _normalizeBounds(bounds: WorldBounds): WorldBounds {
    return {
      minX: Math.min(bounds.minX, bounds.maxX),
      minY: Math.min(bounds.minY, bounds.maxY),
      maxX: Math.max(bounds.minX, bounds.maxX),
      maxY: Math.max(bounds.minY, bounds.maxY),
    }
  }

  private _intersects(a: WorldBounds, b: WorldBounds) {
    const viewport = this._normalizeBounds(b)
    return (
      a.minX <= viewport.maxX &&
      a.maxX >= viewport.minX &&
      a.minY <= viewport.maxY &&
      a.maxY >= viewport.minY
    )
  }

  private _worldToViewportBounds(
    bounds: WorldBounds,
    context: RenderLayerEncodeContext
  ): ViewportRect {
    const points = [
      context.camera.toScreen(bounds.minX, bounds.minY),
      context.camera.toScreen(bounds.maxX, bounds.minY),
      context.camera.toScreen(bounds.maxX, bounds.maxY),
      context.camera.toScreen(bounds.minX, bounds.maxY),
    ]
    const xs = points.map(point => point.x)
    const ys = points.map(point => point.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }
}
