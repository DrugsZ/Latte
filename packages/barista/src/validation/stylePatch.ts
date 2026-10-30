import { BlendModeType, FillType, type IStylePatch } from '@latte-js/bean'

const STYLE_KEYS = new Set(['name', 'fills', 'opacity', 'visible', 'locked'])
const isUnitNumber = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1

export const validateStylePatch = (patch: IStylePatch) => {
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
    throw new Error('[StyleService] Expected a style patch')
  }
  for (const key of Object.keys(patch)) {
    if (!STYLE_KEYS.has(key)) {
      throw new Error(`[StyleService] Unsupported property: ${key}`)
    }
  }
  if (patch.name !== undefined && typeof patch.name !== 'string') {
    throw new Error('[StyleService] name must be a string')
  }
  if (patch.opacity !== undefined && !isUnitNumber(patch.opacity)) {
    throw new Error('[StyleService] opacity must be between 0 and 1')
  }
  for (const key of ['visible', 'locked'] as const) {
    if (patch[key] !== undefined && typeof patch[key] !== 'boolean') {
      throw new Error(`[StyleService] ${key} must be a boolean`)
    }
  }
  if (patch.fills === undefined) {
    return
  }
  if (!Array.isArray(patch.fills)) {
    throw new Error('[StyleService] fills must be an array')
  }
  for (const paint of patch.fills) {
    if (!paint || paint.type !== FillType.SOLID) {
      throw new Error('[StyleService] Only solid fills are supported')
    }
    if (
      typeof paint.visible !== 'boolean' ||
      !isUnitNumber(paint.opacity) ||
      !Number.isInteger(paint.blendMode) ||
      paint.blendMode < BlendModeType.NORMAL ||
      paint.blendMode > BlendModeType.LUMINOSITY ||
      !paint.color ||
      !['r', 'g', 'b', 'a'].every(key =>
        isUnitNumber(paint.color[key as keyof typeof paint.color])
      )
    ) {
      throw new Error('[StyleService] Invalid solid fill')
    }
  }
}
