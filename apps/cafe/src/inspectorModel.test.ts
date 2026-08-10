import { describe, expect, it } from 'vitest'

import {
  INSPECTOR_PROPERTY_FIELDS,
  isInspectorPropertyEditable,
  toPropertyPatch,
} from './inspectorModel'

describe('inspectorModel', () => {
  it('exposes all P0 editable fields through the inspector field list', () => {
    expect(INSPECTOR_PROPERTY_FIELDS.map(field => field.key)).toEqual([
      'x',
      'y',
      'width',
      'height',
      'rotation',
      'opacity',
      'fill',
      'stroke',
      'strokeWeight',
      'cornerRadius',
      'visible',
      'locked',
    ])
  })

  it('maps inspector field commits to worker PropertyService patches', () => {
    expect(toPropertyPatch('rotation', '45')).toEqual({ rotation: 45 })
    expect(toPropertyPatch('opacity', '0.5')).toEqual({ opacity: 0.5 })
    expect(toPropertyPatch('cornerRadius', '8')).toEqual({ cornerRadius: 8 })
    expect(toPropertyPatch('visible', false)).toEqual({ visible: false })
    expect(toPropertyPatch('locked', true)).toEqual({ locked: true })
    expect(toPropertyPatch('fill', '#ff0000')).toEqual({
      fills: [
        expect.objectContaining({
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0, a: 1 },
        }),
      ],
    })
    expect(toPropertyPatch('stroke', '#00ff00')).toEqual({
      strokes: [
        expect.objectContaining({
          type: 'SOLID',
          color: { r: 0, g: 1, b: 0, a: 1 },
        }),
      ],
    })
  })

  it('disables unavailable and all-required partial properties', () => {
    const width = INSPECTOR_PROPERTY_FIELDS.find(
      field => field.key === 'width'
    )!
    const fill = INSPECTOR_PROPERTY_FIELDS.find(field => field.key === 'fill')!

    expect(isInspectorPropertyEditable(width, 'unavailable')).toBe(false)
    expect(isInspectorPropertyEditable(width, 'partial')).toBe(false)
    expect(isInspectorPropertyEditable(width, 'mixed')).toBe(true)
    expect(isInspectorPropertyEditable(fill, 'partial')).toBe(true)
  })
})
