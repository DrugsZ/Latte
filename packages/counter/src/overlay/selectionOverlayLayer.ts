import {
  PaintStyle,
  RenderCommandBuffer,
  RenderCommandType,
} from '@latte-js/art'

import {
  SelectionOverlayGeometryBuilder,
  type SelectionOverlayGeometry,
  type ViewportRect,
} from './selectionOverlayGeometry'

import type {
  RenderLayer,
  RenderLayerEncodeContext,
  RenderLayerHitResult,
  RenderLayerHitTestContext,
  RenderLayerHitTestPoint,
} from '@latte-js/art'
import type { IDType } from '@latte-js/bean'
import type { SelectionService } from '../services/selection/selectionService'

export const SELECTION_OVERLAY_LAYER_ID = 'latte.selection-overlay'

export type SelectionOverlayHitData =
  | {
      readonly type: 'resize-handle'
      readonly ids: readonly IDType[]
      readonly direction: string
    }
  | {
      readonly type: 'selection-bounds'
      readonly ids: readonly IDType[]
    }

const IDENTITY_TRANSFORM = new Float32Array([1, 0, 0, 1, 0, 0])
const SELECTION_BLUE = 0x2f80ffff
const HANDLE_FILL = 0xffffffff
const BOUNDS_STROKE_WIDTH = 1
const BOUNDS_HIT_TOLERANCE = 4

export class SelectionOverlayLayer implements RenderLayer {
  public readonly id = SELECTION_OVERLAY_LAYER_ID
  public readonly zIndex = 1000

  private readonly _geometryBuilder = new SelectionOverlayGeometryBuilder()

  constructor(private readonly _selectionService: SelectionService) {}

  public encode(context: RenderLayerEncodeContext) {
    const geometry = this._buildGeometry(context)
    if (!geometry) {
      return null
    }

    const buffer = new RenderCommandBuffer()
    this._drawBounds(buffer, geometry.group.viewportBounds)
    for (const handle of geometry.handles) {
      this._drawHandle(buffer, handle.viewportBounds)
    }
    return buffer
  }

  public hitTest(
    point: RenderLayerHitTestPoint,
    context: RenderLayerHitTestContext
  ): RenderLayerHitResult | null {
    const geometry = this._buildGeometry(context)
    if (!geometry) {
      return null
    }

    for (const handle of geometry.handles) {
      if (this._containsPoint(handle.viewportBounds, point.viewport)) {
        return {
          layerId: this.id,
          targetId: handle.id,
          data: {
            type: 'resize-handle',
            ids: geometry.group.ids,
            direction: handle.direction,
          },
        }
      }
    }

    if (this._isOnBoundsStroke(geometry.group.viewportBounds, point.viewport)) {
      return {
        layerId: this.id,
        targetId: 'selection-bounds',
        data: {
          type: 'selection-bounds',
          ids: geometry.group.ids,
        },
      }
    }

    return null
  }

  private _buildGeometry(
    context: RenderLayerEncodeContext | RenderLayerHitTestContext
  ): SelectionOverlayGeometry | null {
    return this._geometryBuilder.build({
      sceneGraph: context.sceneGraph,
      selectionIds: this._selectionService.ids,
      activeRootId: context.activeRootId,
      camera: context.camera,
    })
  }

  private _drawBounds(buffer: RenderCommandBuffer, bounds: ViewportRect) {
    buffer.push({
      type: RenderCommandType.DrawRect,
      transform: Float32Array.from(IDENTITY_TRANSFORM),
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      cornerRadius: 0,
      paint: {
        style: PaintStyle.Stroke,
        color: SELECTION_BLUE,
        stroke: { width: BOUNDS_STROKE_WIDTH },
      },
    })
  }

  private _drawHandle(buffer: RenderCommandBuffer, bounds: ViewportRect) {
    buffer.push({
      type: RenderCommandType.DrawRect,
      transform: Float32Array.from(IDENTITY_TRANSFORM),
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      cornerRadius: 1,
      paint: {
        style: PaintStyle.Fill,
        color: HANDLE_FILL,
      },
    })
    buffer.push({
      type: RenderCommandType.DrawRect,
      transform: Float32Array.from(IDENTITY_TRANSFORM),
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      cornerRadius: 1,
      paint: {
        style: PaintStyle.Stroke,
        color: SELECTION_BLUE,
        stroke: { width: 1 },
      },
    })
  }

  private _containsPoint(rect: ViewportRect, point: { x: number; y: number }) {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    )
  }

  private _isOnBoundsStroke(
    rect: ViewportRect,
    point: { x: number; y: number }
  ) {
    const outer = this._inflate(rect, BOUNDS_HIT_TOLERANCE)
    const inner = this._inflate(rect, -BOUNDS_HIT_TOLERANCE)
    if (!this._containsPoint(outer, point)) {
      return false
    }
    if (inner.width <= 0 || inner.height <= 0) {
      return true
    }
    return !this._containsPoint(inner, point)
  }

  private _inflate(rect: ViewportRect, amount: number): ViewportRect {
    return {
      x: rect.x - amount,
      y: rect.y - amount,
      width: rect.width + amount * 2,
      height: rect.height + amount * 2,
    }
  }
}
