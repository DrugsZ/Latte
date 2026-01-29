import {
  FillType,
  type IPaint,
  type FillColor,
  type ISolidColorPaint,
  type IGradientLinearPaint,
  type IGradientRadialPaint,
  type IGradientAngularPaint,
  type IGradientDiamondPaint,
  type IImagePaint,
} from '@latte-js/bean'
import {
  type IRenderBackend,
  type Gradient,
  type GradientStop,
  GradientType,
} from '../contract/renderBackend'

/**
 * Convert FillColor (r, g, b, a in 0-1 range) to 0xRRGGBBAA format
 */
export function fillColorToHex(color: FillColor): number {
  const r = Math.round(color.r * 255) & 0xff
  const g = Math.round(color.g * 255) & 0xff
  const b = Math.round(color.b * 255) & 0xff
  const a = Math.round(color.a * 255) & 0xff

  return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0
}

/**
 * Apply opacity to a color
 */
export function applyOpacity(color: number, opacity: number): number {
  if (opacity >= 1) return color
  const a = Math.round((color & 0xff) * opacity) & 0xff
  return ((color & 0xffffff00) | a) >>> 0
}

/**
 * Paint result types for rendering
 */
export type PaintResult =
  | { type: 'solid'; color: number }
  | { type: 'gradient'; gradientId: number }
  | { type: 'image'; imageId: string; transform?: Float32Array }
  | { type: 'none' }

/**
 * Convert gradient stops from IPaint format to backend format
 */
function convertGradientStops(
  stops: { color: FillColor; position: number }[],
  paintOpacity: number
): GradientStop[] {
  return stops.map(stop => ({
    offset: stop.position,
    color: applyOpacity(fillColorToHex(stop.color), paintOpacity),
  }))
}

/**
 * Create a gradient from a gradient paint
 */
export function createGradientFromPaint(
  backend: IRenderBackend,
  paint:
    | IGradientLinearPaint
    | IGradientRadialPaint
    | IGradientAngularPaint
    | IGradientDiamondPaint,
  width: number,
  height: number
): number {
  const stops = convertGradientStops(paint.stops, paint.opacity)

  let gradient: Gradient

  switch (paint.type) {
    case FillType.GRADIENT_LINEAR: {
      // Linear gradient: transform defines the direction
      // Default is top-left to bottom-right
      const transform = paint.transform || [1, 0, 0, 1, 0, 0]
      // Apply transform to get gradient line
      const x0 = transform[4] * width
      const y0 = transform[5] * height
      const x1 = (transform[0] + transform[4]) * width
      const y1 = (transform[1] + transform[5]) * height

      gradient = {
        type: GradientType.LINEAR,
        stops,
        coords: Float32Array.from([x0, y0, x1, y1]),
      }
      break
    }

    case FillType.GRADIENT_RADIAL: {
      // Radial gradient: center with radius
      const cx = width / 2
      const cy = height / 2
      const r = Math.max(width, height) / 2

      gradient = {
        type: GradientType.RADIAL,
        stops,
        coords: Float32Array.from([cx, cy, 0, cx, cy, r]),
      }
      break
    }

    case FillType.GRADIENT_ANGULAR: {
      // Angular/Conic gradient
      const cx = width / 2
      const cy = height / 2

      gradient = {
        type: GradientType.CONIC,
        stops,
        coords: Float32Array.from([cx, cy, 0]),
      }
      break
    }

    case FillType.GRADIENT_DIAMOND: {
      // Diamond gradient - approximate with radial for now
      const cx = width / 2
      const cy = height / 2
      const r = Math.max(width, height) / 2

      gradient = {
        type: GradientType.RADIAL,
        stops,
        coords: Float32Array.from([cx, cy, 0, cx, cy, r]),
      }
      break
    }
  }

  return backend.createGradient(gradient)
}

/**
 * Process a paint and return the appropriate result for rendering
 */
export function processPaint(
  backend: IRenderBackend,
  paint: IPaint,
  width: number,
  height: number
): PaintResult {
  if (!paint.visible || paint.opacity <= 0) {
    return { type: 'none' }
  }

  switch (paint.type) {
    case FillType.SOLID: {
      const solidPaint = paint as ISolidColorPaint
      const color = applyOpacity(
        fillColorToHex(solidPaint.color),
        solidPaint.opacity
      )
      return { type: 'solid', color }
    }

    case FillType.GRADIENT_LINEAR:
    case FillType.GRADIENT_RADIAL:
    case FillType.GRADIENT_ANGULAR:
    case FillType.GRADIENT_DIAMOND: {
      const gradientId = createGradientFromPaint(
        backend,
        paint as
          | IGradientLinearPaint
          | IGradientRadialPaint
          | IGradientAngularPaint
          | IGradientDiamondPaint,
        width,
        height
      )
      return { type: 'gradient', gradientId }
    }

    case FillType.IMAGE: {
      const imagePaint = paint as IImagePaint
      return {
        type: 'image',
        imageId: imagePaint.image.hash,
        transform: imagePaint.transform
          ? Float32Array.from(imagePaint.transform)
          : undefined,
      }
    }

    default:
      return { type: 'none' }
  }
}

/**
 * Get the first visible solid color from a paint array
 * Returns undefined if no valid solid color found
 */
export function getFirstSolidColor(paints: IPaint[]): number | undefined {
  for (const paint of paints) {
    if (!paint.visible || paint.opacity <= 0) continue

    if (paint.type === FillType.SOLID) {
      const baseColor = fillColorToHex(paint.color)
      return applyOpacity(baseColor, paint.opacity)
    }
  }

  return undefined
}

/**
 * Get the first visible paint result from a paint array
 */
export function getFirstPaint(
  backend: IRenderBackend,
  paints: IPaint[],
  width: number,
  height: number
): PaintResult {
  for (const paint of paints) {
    const result = processPaint(backend, paint, width, height)
    if (result.type !== 'none') {
      return result
    }
  }
  return { type: 'none' }
}

/**
 * Check if a paint array has any visible fills
 */
export function hasVisibleFills(paints: IPaint[]): boolean {
  return paints.some(p => p.visible && p.opacity > 0)
}
