import {
  PaintStyle,
  RenderCommandBuffer,
  RenderCommandType,
} from '@latte-js/art'

import {
  SELECTION_OVERLAY_LAYER_ID,
  SelectionOverlayHitType,
  SelectionOverlayTargetId,
} from './selectionOverlayConstants'
import {
  SelectionOverlayGeometryBuilder,
  type SelectionOverlayGeometry,
  type ResizeHandleDirection,
  type ViewportRect,
  type ViewportQuad,
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

export {
  SELECTION_OVERLAY_LAYER_ID,
  SelectionOverlayHitType,
  SelectionOverlayTargetId,
} from './selectionOverlayConstants'

export type SelectionOverlayHitData =
  | {
      readonly type: SelectionOverlayHitType.ResizeHandle
      readonly ids: readonly IDType[]
      readonly direction: ResizeHandleDirection
    }
  | {
      readonly type: SelectionOverlayHitType.SelectionBounds
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
    this._drawBounds(buffer, geometry.group.viewportCorners)
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
            type: SelectionOverlayHitType.ResizeHandle,
            ids: geometry.group.ids,
            direction: handle.direction,
          },
        }
      }
    }

    if (
      this._isOnBoundsStroke(geometry.group.viewportCorners, point.viewport)
    ) {
      return {
        layerId: this.id,
        targetId: SelectionOverlayTargetId.SelectionBounds,
        data: {
          type: SelectionOverlayHitType.SelectionBounds,
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

  private _drawBounds(buffer: RenderCommandBuffer, corners: ViewportQuad) {
    const rect = this._quadToLocalRect(corners)
    buffer.push({
      type: RenderCommandType.DrawRect,
      transform: rect.transform,
      x: 0,
      y: 0,
      width: rect.width,
      height: rect.height,
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
    corners: ViewportQuad,
    point: { x: number; y: number }
  ) {
    for (let i = 0; i < corners.length; i += 1) {
      const start = corners[i]
      const end = corners[(i + 1) % corners.length]
      if (this._distanceToSegment(point, start, end) <= BOUNDS_HIT_TOLERANCE) {
        return true
      }
    }
    return false
  }

  private _quadToLocalRect(corners: ViewportQuad) {
    const [origin, xAxisEnd, , yAxisEnd] = corners
    const xAxis = {
      x: xAxisEnd.x - origin.x,
      y: xAxisEnd.y - origin.y,
    }
    const yAxis = {
      x: yAxisEnd.x - origin.x,
      y: yAxisEnd.y - origin.y,
    }
    const width = Math.hypot(xAxis.x, xAxis.y)
    const height = Math.hypot(yAxis.x, yAxis.y)

    if (width === 0 || height === 0) {
      return {
        width: 0,
        height: 0,
        transform: Float32Array.from(IDENTITY_TRANSFORM),
      }
    }

    return {
      width,
      height,
      transform: Float32Array.from([
        xAxis.x / width,
        xAxis.y / width,
        yAxis.x / height,
        yAxis.y / height,
        origin.x,
        origin.y,
      ]),
    }
  }

  private _distanceToSegment(
    point: { x: number; y: number },
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    if (lengthSquared === 0) {
      return Math.hypot(point.x - start.x, point.y - start.y)
    }

    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
      )
    )
    return Math.hypot(
      point.x - (start.x + t * dx),
      point.y - (start.y + t * dy)
    )
  }
}
