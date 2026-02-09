import { StrokeAlign } from '@latte-js/bean'
import type { INodeRenderer } from '../typing'
import { getFirstPaint, getFirstSolidColor } from './utils'

export const RectRenderer: INodeRenderer = {
  render(backend, cursor) {
    const {
      width,
      height,
      fills,
      strokes,
      strokeWeight,
      strokeAlign,
      cornerRadius: cr,
    } = cursor

    // Get fill paint (supports solid, gradient, image)
    const fillPaint = getFirstPaint(backend, fills, width, height)

    // Get stroke color (solid only for now)
    const strokeColor =
      strokeWeight > 0 ? getFirstSolidColor(strokes) : undefined

    // Get corner radius - use uniform if all same, otherwise per-corner
    // cr is [topLeft, topRight, bottomRight, bottomLeft]
    let cornerRadius: number | Float32Array = 0
    const [tl, tr, br, bl] = cr
    if (tl === tr && tr === br && br === bl) {
      cornerRadius = tl
    } else if (tl > 0 || tr > 0 || br > 0 || bl > 0) {
      cornerRadius = Float32Array.from(cr)
    }

    // Adjust position based on stroke alignment
    let x = 0
    let y = 0
    let w = width
    let h = height
    const actualStrokeWidth = strokeWeight

    if (strokeWeight > 0 && strokeColor !== undefined) {
      switch (strokeAlign) {
        case StrokeAlign[StrokeAlign.INSIDE]:
          // Stroke is inside, no position adjustment needed
          break
        case StrokeAlign[StrokeAlign.OUTSIDE]:
          // Stroke is outside
          x = -strokeWeight / 2
          y = -strokeWeight / 2
          w = width + strokeWeight
          h = height + strokeWeight
          break
        case StrokeAlign[StrokeAlign.CENTER]:
        default:
          // Stroke is centered on the edge
          break
      }
    }

    // Render based on fill type
    switch (fillPaint.type) {
      case 'solid':
        backend.drawRect(
          x,
          y,
          w,
          h,
          cornerRadius,
          fillPaint.color,
          strokeColor,
          actualStrokeWidth
        )
        break

      case 'gradient':
        // Draw with gradient fill
        // Note: gradientId is used as fill parameter
        backend.drawRect(
          x,
          y,
          w,
          h,
          cornerRadius,
          fillPaint.gradientId,
          strokeColor,
          actualStrokeWidth
        )
        // Clean up gradient resource after use
        backend.deleteGradient(fillPaint.gradientId)
        break

      case 'image':
        // Draw image fill
        backend.drawImage(fillPaint.imageId, x, y, w, h)
        // Draw stroke separately if needed
        if (strokeColor !== undefined && actualStrokeWidth > 0) {
          backend.drawRect(
            x,
            y,
            w,
            h,
            cornerRadius,
            undefined,
            strokeColor,
            actualStrokeWidth
          )
        }
        break

      case 'none':
      default:
        // No fill, just stroke if present
        // if (strokeColor !== undefined && actualStrokeWidth > 0) {
        backend.drawRect(
          x,
          y,
          w,
          h,
          cornerRadius,
          0xffffffff,
          strokeColor,
          actualStrokeWidth
        )
        // }
        break
    }
  },
}
