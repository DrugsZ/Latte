import { StrokeAlign } from '@latte-js/bean'

import { getFirstPaint, getFirstSolidColor } from './utils'

import type { INodeRenderer } from '../typing'

export const EllipseRenderer: INodeRenderer = {
  render(backend, cursor) {
    const { width, height, fills, strokes, strokeWeight, strokeAlign } = cursor

    // Get fill paint (supports solid, gradient, image)
    const fillPaint = getFirstPaint(backend, fills, width, height)

    // Get stroke color (solid only for now)
    const strokeColor =
      strokeWeight > 0 ? getFirstSolidColor(strokes) : undefined

    // Calculate center and radii
    const cx = width / 2
    const cy = height / 2
    let rx = width / 2
    let ry = height / 2
    const actualStrokeWidth = strokeWeight

    if (strokeWeight > 0 && strokeColor !== undefined) {
      switch (strokeAlign) {
        case StrokeAlign[StrokeAlign.INSIDE]:
          // Stroke is inside
          break
        case StrokeAlign[StrokeAlign.OUTSIDE]:
          // Stroke is outside, expand the ellipse
          rx += strokeWeight / 2
          ry += strokeWeight / 2
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
        backend.drawEllipse(
          cx,
          cy,
          rx,
          ry,
          0,
          fillPaint.color,
          strokeColor,
          actualStrokeWidth
        )
        break

      case 'gradient':
        // Draw with gradient fill
        backend.drawEllipse(
          cx,
          cy,
          rx,
          ry,
          0,
          fillPaint.gradientId,
          strokeColor,
          actualStrokeWidth
        )
        // Clean up gradient resource after use
        backend.deleteGradient(fillPaint.gradientId)
        break

      case 'image':
        // Draw image fill (approximate with rectangle for now)
        backend.drawImage(fillPaint.imageId, 0, 0, width, height)
        // Draw stroke separately if needed
        if (strokeColor !== undefined && actualStrokeWidth > 0) {
          backend.drawEllipse(
            cx,
            cy,
            rx,
            ry,
            0,
            undefined,
            strokeColor,
            actualStrokeWidth
          )
        }
        break

      case 'none':
      default:
        // No fill, just stroke if present
        if (strokeColor !== undefined && actualStrokeWidth > 0) {
          backend.drawEllipse(
            cx,
            cy,
            rx,
            ry,
            0,
            undefined,
            strokeColor,
            actualStrokeWidth
          )
        }
        break
    }
  },
}
