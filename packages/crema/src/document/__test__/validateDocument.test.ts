import { describe, expect, it } from 'vitest'
import {
  LatteLoader,
  MAX_NODES,
  SceneGraph,
  Serializer,
} from '@latte-js/espresso'

import sample from '@cafe/assets/sample.json'
import { assertLatteFile, validateDocument } from '../validateDocument'

const document = () =>
  structuredClone(sample) as {
    elements: Array<Record<string, any>>
  }

describe('document import validation', () => {
  it('accepts the bundled sample without changing its optional data', () => {
    const data = document()
    const original = structuredClone(data)
    expect(validateDocument(data)).toBe(data)
    expect(data).toEqual(original)
  })

  it('accepts a serializer output and preserves the entire supported sample after reload', () => {
    const original = validateDocument(document())
    const graph = new SceneGraph()
    new LatteLoader(graph).load(original)
    const saved = new Serializer(graph).serialize()
    assertLatteFile(saved)

    const reloaded = new SceneGraph()
    new LatteLoader(reloaded).load(saved)
    expect(new Serializer(reloaded).serialize()).toEqual(saved)
    expect(saved.elements.find(node => node.guid === '19:4')).toMatchObject({
      fillPaints: document().elements[3].fillPaints.map((paint: object) => ({
        ...paint,
        blendMode: 0,
      })),
    })
  })

  it.each([
    null,
    [],
    'invalid',
    {},
    { elements: [] },
    { elements: [null, {}] },
  ])('rejects malformed external JSON shape: %j', value => {
    expect(() => validateDocument(value)).toThrow('[DocumentImport]')
  })

  it('rejects duplicate ids', () => {
    const data = document()
    data.elements[3].guid = data.elements[2].guid
    expect(() => validateDocument(data)).toThrow('duplicate id')
  })

  it('rejects unsupported node types rather than silently displaying an empty shape', () => {
    const data = document()
    data.elements[2].type = 'TEXT'
    expect(() => validateDocument(data)).toThrow('unsupported node type')
  })

  it('rejects a missing or extra document root', () => {
    const data = document()
    data.elements = data.elements.filter(node => node.type !== 'DOCUMENT')
    expect(() => validateDocument(data)).toThrow('expected one DOCUMENT')
    const duplicated = document()
    duplicated.elements.push({ type: 'DOCUMENT', guid: 'other:root' })
    expect(() => validateDocument(duplicated)).toThrow('only one DOCUMENT')
  })

  it('rejects a document without a canvas', () => {
    const data = document()
    data.elements[1].type = 'GROUP'
    expect(() => validateDocument(data)).toThrow('at least one CANVAS')
  })

  it('rejects disconnected nodes and parents which cannot contain children', () => {
    const missingParent = document()
    missingParent.elements[2].parentIndex.guid = 'missing:parent'
    expect(() => validateDocument(missingParent)).toThrow('missing parent')
    const notContainer = document()
    notContainer.elements[3].parentIndex.guid = notContainer.elements[2].guid
    expect(() => validateDocument(notContainer)).toThrow(
      'parent must be a container'
    )
  })

  it('rejects cycles using an iterative parent traversal', () => {
    const data = document()
    data.elements[2].type = 'GROUP'
    data.elements[3].type = 'GROUP'
    data.elements[2].parentIndex.guid = data.elements[3].guid
    data.elements[3].parentIndex.guid = data.elements[2].guid
    expect(() => validateDocument(data)).toThrow('parent cycle')
  })

  it.each([Number.NaN, Infinity, 1e100, '10'])(
    'rejects invalid matrix values: %j',
    value => {
      const data = document()
      data.elements[2].transform[4] = value
      expect(() => validateDocument(data)).toThrow('finite number')
    }
  )

  it('rejects non-string sibling positions and negative dimensions', () => {
    const data = document()
    data.elements[2].parentIndex.position = 1
    expect(() => validateDocument(data)).toThrow('sibling position')
    data.elements[2].parentIndex.position = '1'
    data.elements[2].size.x = -1
    expect(() => validateDocument(data)).toThrow('size.x')
  })

  it('rejects invalid fill colors, opacities and unsupported asset paints', () => {
    const data = document()
    data.elements[2].fillPaints[0].color.r = 1.1
    expect(() => validateDocument(data)).toThrow('.color.r')
    data.elements[2].fillPaints[0].color.r = 1
    data.elements[2].opacity = -0.1
    expect(() => validateDocument(data)).toThrow('.opacity')
    data.elements[2].opacity = 1
    data.elements[2].fillPaints[0].type = 'IMAGE'
    expect(() => validateDocument(data)).toThrow('only solid and gradient')
  })

  it('rejects node arrays exceeding shared memory capacity', () => {
    const data = { elements: new Array(MAX_NODES + 1) }
    expect(() => validateDocument(data)).toThrow('capacity')
  })

  it('rejects edits whose file semantics have no current data representation', () => {
    const data = document()
    data.elements[2].blendMode = 'MULTIPLY'
    expect(() => validateDocument(data)).toThrow('layer blending')
    data.elements[2].blendMode = 'NORMAL'
    data.elements[2].cornerSmoothing = 0.3
    expect(() => validateDocument(data)).toThrow('corner smoothing')
    data.elements[2].cornerSmoothing = 0
    data.elements[2].strokeTopWeight = 4
    expect(() => validateDocument(data)).toThrow('independent edge stroke')
  })
})
