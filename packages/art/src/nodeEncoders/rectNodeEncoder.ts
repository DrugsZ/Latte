import { StrokeAlign } from '@latte-js/bean'

import { getFirstPaint, getFirstSolidStrokePaint } from './paintEncoding'

import type { INodeCommandEncoder } from './types'

export const RectNodeEncoder: INodeCommandEncoder = {
  encode(encoder, cursor) {
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
    const fillPaint = getFirstPaint(encoder, fills, width, height)

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
    const strokeStyle = { width: strokeWeight }
    const strokePaint =
      strokeWeight > 0
        ? getFirstSolidStrokePaint(strokes, strokeStyle)
        : undefined

    if (strokeWeight > 0 && strokePaint !== undefined) {
      switch (strokeAlign) {
        case StrokeAlign[StrokeAlign.INSIDE]:
          // Stroke is inside, no position adjustment needed
          break
        case StrokeAlign[StrokeAlign.OUTSIDE]:
          // Stroke is outside
          x -= strokeWeight / 2
          y -= strokeWeight / 2
          w = width + strokeWeight
          h = height + strokeWeight
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
        encoder.drawRect(x, y, w, h, cornerRadius, fillPaint.paint)
        if (strokePaint) {
          encoder.drawRect(x, y, w, h, cornerRadius, strokePaint)
        }
        break

      case 'image':
        // Draw image fill
        encoder.drawImage(
          fillPaint.imageId,
          x,
          y,
          w,
          h,
          undefined,
          undefined,
          undefined,
          undefined,
          fillPaint.paint
        )
        // Draw stroke separately if needed
        if (strokePaint) {
          encoder.drawRect(x, y, w, h, cornerRadius, strokePaint)
        }
        break

      case 'none':
      default:
        if (strokePaint) {
          encoder.drawRect(x, y, w, h, cornerRadius, strokePaint)
        }
        break
    }
  },
}
