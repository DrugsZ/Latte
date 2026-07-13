import { StrokeAlign } from '@latte-js/bean'

import { getFirstPaint, getFirstSolidStrokePaint } from './paintEncoding'

import type { INodeCommandEncoder } from './types'

export const EllipseNodeEncoder: INodeCommandEncoder = {
  encode(encoder, cursor) {
    const { width, height, fills, strokes, strokeWeight, strokeAlign } = cursor

    // Get fill paint (supports solid, gradient, image)
    const fillPaint = getFirstPaint(encoder, fills, width, height)

    // Calculate center and radii
    const cx = width / 2
    const cy = height / 2
    let rx = width / 2
    let ry = height / 2
    const strokeStyle = { width: strokeWeight }
    const strokePaint =
      strokeWeight > 0
        ? getFirstSolidStrokePaint(strokes, strokeStyle)
        : undefined

    if (strokeWeight > 0 && strokePaint !== undefined) {
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

    // Encode fill and stroke as separate paint commands.
    switch (fillPaint.type) {
      case 'paint':
        encoder.drawEllipse(cx, cy, rx, ry, 0, fillPaint.paint)
        if (strokePaint) {
          encoder.drawEllipse(cx, cy, rx, ry, 0, strokePaint)
        }
        break

      case 'image':
        // Draw image fill (approximate with rectangle for now)
        encoder.drawImage(
          fillPaint.imageId,
          0,
          0,
          width,
          height,
          undefined,
          undefined,
          undefined,
          undefined,
          fillPaint.paint
        )
        // Draw stroke separately if needed
        if (strokePaint) {
          encoder.drawEllipse(cx, cy, rx, ry, 0, strokePaint)
        }
        break

      case 'none':
      default:
        if (strokePaint) {
          encoder.drawEllipse(cx, cy, rx, ry, 0, strokePaint)
        }
        break
    }
  },
}
