import {
  BlendModeType,
  type FillColor,
  FillType,
  type IGradientAngularPaint,
  type IGradientDiamondPaint,
  type IGradientLinearPaint,
  type IGradientRadialPaint,
  type IImagePaint,
  type IPaint,
  type ISolidColorPaint,
} from '@latte-js/bean'

import {
  BlendMode,
  type GradientStop,
  type IRenderCommandEncoder,
  type Paint,
  PaintStyle,
  type Shader,
  ShaderType,
  type StrokeStyle,
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
 * Encoded paint result used by node command encoders.
 */
export type PaintResult =
  | { type: 'paint'; paint: Paint }
  | { type: 'image'; imageId: string; paint?: Paint; transform?: Float32Array }
  | { type: 'none' }

export function blendModeToRenderBlendMode(mode: BlendModeType): BlendMode {
  switch (mode) {
    case BlendModeType.MULTIPLY:
      return BlendMode.MULTIPLY
    case BlendModeType.SCREEN:
      return BlendMode.SCREEN
    case BlendModeType.OVERLAY:
      return BlendMode.OVERLAY
    case BlendModeType.DARKEN:
      return BlendMode.DARKEN
    case BlendModeType.LIGHTEN:
      return BlendMode.LIGHTEN
    case BlendModeType.COLOR_DODGE:
      return BlendMode.COLOR_DODGE
    case BlendModeType.COLOR_BURN:
      return BlendMode.COLOR_BURN
    case BlendModeType.HARD_LIGHT:
      return BlendMode.HARD_LIGHT
    case BlendModeType.SOFT_LIGHT:
      return BlendMode.SOFT_LIGHT
    case BlendModeType.DIFFERENCE:
      return BlendMode.DIFFERENCE
    case BlendModeType.EXCLUSION:
      return BlendMode.EXCLUSION
    case BlendModeType.HUE:
      return BlendMode.HUE
    case BlendModeType.SATURATION:
      return BlendMode.SATURATION
    case BlendModeType.COLOR:
      return BlendMode.COLOR
    case BlendModeType.LUMINOSITY:
      return BlendMode.LUMINOSITY
    case BlendModeType.NORMAL:
    default:
      return BlendMode.NORMAL
  }
}

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
export function createShaderFromPaint(
  encoder: IRenderCommandEncoder,
  paint:
    | IGradientLinearPaint
    | IGradientRadialPaint
    | IGradientAngularPaint
    | IGradientDiamondPaint,
  width: number,
  height: number
): Paint {
  const stops = convertGradientStops(paint.stops, paint.opacity)

  let shader: Shader

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

      shader = {
        type: ShaderType.LINEAR_GRADIENT,
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

      shader = {
        type: ShaderType.RADIAL_GRADIENT,
        stops,
        coords: Float32Array.from([cx, cy, 0, cx, cy, r]),
      }
      break
    }

    case FillType.GRADIENT_ANGULAR: {
      // Angular/Conic gradient
      const cx = width / 2
      const cy = height / 2

      shader = {
        type: ShaderType.CONIC_GRADIENT,
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

      shader = {
        type: ShaderType.RADIAL_GRADIENT,
        stops,
        coords: Float32Array.from([cx, cy, 0, cx, cy, r]),
      }
      break
    }
  }

  return {
    style: PaintStyle.Fill,
    shader: encoder.createShader(shader),
    blendMode: blendModeToRenderBlendMode(paint.blendMode),
  }
}

/**
 * Process a paint and return the appropriate result for rendering
 */
export function processPaint(
  encoder: IRenderCommandEncoder,
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
      return {
        type: 'paint',
        paint: {
          style: PaintStyle.Fill,
          color,
          blendMode: blendModeToRenderBlendMode(solidPaint.blendMode),
        },
      }
    }

    case FillType.GRADIENT_LINEAR:
    case FillType.GRADIENT_RADIAL:
    case FillType.GRADIENT_ANGULAR:
    case FillType.GRADIENT_DIAMOND: {
      const gradient = createShaderFromPaint(
        encoder,
        paint as
          | IGradientLinearPaint
          | IGradientRadialPaint
          | IGradientAngularPaint
          | IGradientDiamondPaint,
        width,
        height
      )
      return { type: 'paint', paint: gradient }
    }

    case FillType.IMAGE: {
      const imagePaint = paint as IImagePaint
      return {
        type: 'image',
        imageId: imagePaint.image.hash,
        paint: {
          style: PaintStyle.Fill,
          alpha: imagePaint.opacity,
          blendMode: blendModeToRenderBlendMode(imagePaint.blendMode),
        },
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
 * Get the first visible solid paint from a paint array.
 * Returns undefined if no valid solid paint is found.
 */
export function getFirstSolidStrokePaint(
  paints: IPaint[],
  stroke: StrokeStyle
): Paint | undefined {
  for (const paint of paints) {
    if (!paint.visible || paint.opacity <= 0) continue

    if (paint.type === FillType.SOLID) {
      const baseColor = fillColorToHex(paint.color)
      return {
        style: PaintStyle.Stroke,
        color: applyOpacity(baseColor, paint.opacity),
        blendMode: blendModeToRenderBlendMode(paint.blendMode),
        stroke,
      }
    }
  }

  return undefined
}

/**
 * Get the first visible encoded paint result from a paint array.
 */
export function getFirstPaint(
  encoder: IRenderCommandEncoder,
  paints: IPaint[],
  width: number,
  height: number
): PaintResult {
  for (const paint of paints) {
    const result = processPaint(encoder, paint, width, height)
    if (result.type !== 'none') {
      return result
    }
  }
  return { type: 'none' }
}

/**
 * Check if a paint array has any visible fills.
 */
export function hasVisibleFills(paints: IPaint[]): boolean {
  return paints.some(p => p.visible && p.opacity > 0)
}
