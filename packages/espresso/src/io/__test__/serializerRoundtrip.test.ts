import {
  BlendModeType,
  FillType,
  type ILatteFile,
  type ISolidColorPaint,
} from '@latte-js/bean'
import { describe, expect, it } from 'vitest'

import { NodeCursor } from '../../data/nodeCursor'
import { SceneGraph } from '../../data/sceneGraph'
import { LatteLoader } from '../latteLoader'
import { Serializer } from '../serializer'

const fill = (r = 0.2): ISolidColorPaint => ({
  type: FillType.SOLID,
  color: { r, g: 0.3, b: 0.7, a: 0.6 },
  visible: true,
  opacity: 0.8,
  blendMode: BlendModeType.MULTIPLY,
})

describe('supported document roundtrip', () => {
  it('normalizes legacy string paint blend modes before rendering and serialization', () => {
    const graph = new SceneGraph()
    new LatteLoader(graph).load({
      elements: [
        {
          guid: 'test:ellipse',
          type: 'ELLIPSE',
          fillPaints: [{ ...fill(), blendMode: 'MULTIPLY' }],
        },
      ],
    } as unknown as ILatteFile)
    const cursor = new NodeCursor(graph, graph.getIndex('test:ellipse'))
    expect(cursor.fills[0].blendMode).toBe(BlendModeType.MULTIPLY)
    expect(
      new Serializer(graph)
        .serialize()
        .elements.find(node => node.guid === 'test:ellipse')
    ).toMatchObject({
      fillPaints: [fill()],
    })
  })

  it('preserves ellipse paints, canvas backgrounds and individual rectangle corners', () => {
    const data = {
      elements: [
        { guid: 'test:root', type: 'DOCUMENT', name: 'Document' },
        {
          guid: 'test:canvas',
          type: 'CANVAS',
          backgrounds: [fill(0.9)],
          parentIndex: { guid: 'test:root', position: '1' },
        },
        {
          guid: 'test:ellipse',
          type: 'ELLIPSE',
          name: 'Painted ellipse',
          fillPaints: [fill()],
          strokePaints: [fill(0.5)],
          opacity: 0.4,
          transform: [1, 0, 0, 1, 20, 30],
          size: { x: 50, y: 70 },
          parentIndex: { guid: 'test:canvas', position: '1' },
        },
        {
          guid: 'test:rectangle',
          type: 'RECTANGLE',
          fillPaints: [fill(0.8)],
          topLeftRadius: 5,
          topRightRadius: 10,
          bottomRightRadius: 15,
          bottomLeftRadius: 20,
          size: { x: 100, y: 120 },
          parentIndex: { guid: 'test:canvas', position: '2' },
        },
      ],
    } as unknown as ILatteFile
    const original = new SceneGraph()
    new LatteLoader(original).load(data)
    const saved = new Serializer(original).serialize()

    const restored = new SceneGraph()
    new LatteLoader(restored).load(saved)
    const ellipse = new NodeCursor(restored, restored.getIndex('test:ellipse'))
    const rectangle = new NodeCursor(
      restored,
      restored.getIndex('test:rectangle')
    )
    const canvas = new NodeCursor(restored, restored.getIndex('test:canvas'))
    expect(ellipse.fills).toEqual([fill()])
    expect(ellipse.strokes).toEqual([fill(0.5)])
    expect(ellipse.name).toBe('Painted ellipse')
    expect(ellipse.opacity).toBeCloseTo(0.4)
    expect([ellipse.x, ellipse.y, ellipse.width, ellipse.height]).toEqual([
      20, 30, 50, 70,
    ])
    expect(rectangle.cornerRadius).toEqual([5, 10, 15, 20])
    expect(rectangle.fills).toEqual([fill(0.8)])
    expect(canvas.fills).toEqual([fill(0.9)])
    expect(new Serializer(restored).serialize()).toEqual(saved)
  })
})
