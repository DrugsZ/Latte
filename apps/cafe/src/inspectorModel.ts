import {
  BlendModeType,
  FillType,
  type FillColor,
  type IPaint,
  type PropertyValueMap,
} from '@latte-js/bean'

export type InspectorPropertyFieldKey =
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'rotation'
  | 'opacity'
  | 'fill'
  | 'stroke'
  | 'strokeWeight'
  | 'cornerRadius'
  | 'visible'
  | 'locked'

export type InspectorValueState =
  'uniform' | 'mixed' | 'partial' | 'unavailable'

export type InspectorPartialWritePolicy = 'all-required' | 'supported-only'

export interface InspectorPropertyField {
  readonly key: InspectorPropertyFieldKey
  readonly label: string
  readonly input: 'number' | 'color' | 'checkbox'
  readonly partialWritePolicy: InspectorPartialWritePolicy
  readonly min?: number
  readonly max?: number
}

export const INSPECTOR_PROPERTY_FIELDS: readonly InspectorPropertyField[] = [
  {
    key: 'x',
    label: 'X',
    input: 'number',
    partialWritePolicy: 'all-required',
  },
  {
    key: 'y',
    label: 'Y',
    input: 'number',
    partialWritePolicy: 'all-required',
  },
  {
    key: 'width',
    label: 'W',
    input: 'number',
    partialWritePolicy: 'all-required',
    min: 0,
  },
  {
    key: 'height',
    label: 'H',
    input: 'number',
    partialWritePolicy: 'all-required',
    min: 0,
  },
  {
    key: 'rotation',
    label: 'R',
    input: 'number',
    partialWritePolicy: 'all-required',
  },
  {
    key: 'opacity',
    label: 'Opacity',
    input: 'number',
    partialWritePolicy: 'all-required',
    min: 0,
    max: 1,
  },
  {
    key: 'fill',
    label: 'Fill',
    input: 'color',
    partialWritePolicy: 'supported-only',
  },
  {
    key: 'stroke',
    label: 'Stroke',
    input: 'color',
    partialWritePolicy: 'supported-only',
  },
  {
    key: 'strokeWeight',
    label: 'Stroke W',
    input: 'number',
    partialWritePolicy: 'supported-only',
    min: 0,
  },
  {
    key: 'cornerRadius',
    label: 'Radius',
    input: 'number',
    partialWritePolicy: 'supported-only',
    min: 0,
  },
  {
    key: 'visible',
    label: 'Visible',
    input: 'checkbox',
    partialWritePolicy: 'all-required',
  },
  {
    key: 'locked',
    label: 'Locked',
    input: 'checkbox',
    partialWritePolicy: 'all-required',
  },
]

export const isInspectorPropertyEditable = (
  field: InspectorPropertyField,
  state: InspectorValueState
) =>
  state !== 'unavailable' &&
  (state !== 'partial' || field.partialWritePolicy === 'supported-only')

export const createSolidPaint = (hex: string): IPaint => ({
  type: FillType.SOLID,
  visible: true,
  opacity: 1,
  blendMode: BlendModeType.NORMAL,
  color: hexToFillColor(hex),
})

export const fillColorToHex = (color: FillColor) => {
  const toByte = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value * 255)))
      .toString(16)
      .padStart(2, '0')
  return `#${toByte(color.r)}${toByte(color.g)}${toByte(color.b)}`
}

export const hexToFillColor = (hex: string): FillColor => {
  const normalized = hex.replace('#', '')
  const read = (offset: number) =>
    Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255
  return {
    r: read(0),
    g: read(2),
    b: read(4),
    a: 1,
  }
}

export const toPropertyPatch = (
  key: InspectorPropertyFieldKey,
  value: string | boolean
): PropertyValueMap | null => {
  switch (key) {
    case 'x':
    case 'y':
    case 'width':
    case 'height':
    case 'rotation':
    case 'opacity':
    case 'strokeWeight':
    case 'cornerRadius': {
      const number = Number(value)
      if (!Number.isFinite(number)) {
        return null
      }
      if (key === 'cornerRadius') {
        return { cornerRadius: Math.max(0, number) }
      }
      if (key === 'width' || key === 'height' || key === 'strokeWeight') {
        return { [key]: Math.max(0, number) }
      }
      if (key === 'opacity') {
        return { opacity: Math.max(0, Math.min(1, number)) }
      }
      return { [key]: number }
    }
    case 'fill':
      return { fills: [createSolidPaint(String(value))] }
    case 'stroke':
      return { strokes: [createSolidPaint(String(value))] }
    case 'visible':
      return { visible: Boolean(value) }
    case 'locked':
      return { locked: Boolean(value) }
  }
}
