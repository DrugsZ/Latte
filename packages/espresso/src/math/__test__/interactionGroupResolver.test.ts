import { mat2d } from 'gl-matrix'
import { describe, expect, it } from 'vitest'

import { InteractionGroupResolver } from '../interactionGroupResolver'

const expectCloseMatrix = (actual: ArrayLike<number>, expected: number[]) => {
  expect(Array.from(actual).map(value => Number(value.toFixed(4)))).toEqual(
    expected.map(value => Number(value.toFixed(4)))
  )
}

describe('InteractionGroupResolver', () => {
  it('uses a single target OBB as the interaction group box', () => {
    const world = mat2d.create()
    mat2d.translate(world, world, [100, 50])
    mat2d.rotate(world, world, Math.PI / 2)
    const target = { id: 'test:rect', index: 1 } as const
    const resolver = new InteractionGroupResolver({
      getBaseSize: () => ({ width: 100, height: 50 }),
      getBaseWorldMatrix: () => world,
    })

    const box = resolver.resolve([target])!

    expect(box.mode).toBe('single-obb')
    expect(box.ids).toEqual(['test:rect'])
    expect(box.width).toBe(100)
    expect(box.height).toBe(50)
    expectCloseMatrix(box.matrix, [0, 1, -1, 0, 100, 50])
  })

  it('uses a world AABB as the temporary group box for multiple targets', () => {
    const first = { id: 'test:a', index: 1 } as const
    const second = { id: 'test:b', index: 2 } as const
    const firstWorld = mat2d.create()
    mat2d.translate(firstWorld, firstWorld, [10, 20])
    const secondWorld = mat2d.create()
    mat2d.translate(secondWorld, secondWorld, [50, 80])
    const resolver = new InteractionGroupResolver({
      getBaseSize: target =>
        target.id === 'test:a'
          ? { width: 20, height: 10 }
          : { width: 5, height: 15 },
      getBaseWorldMatrix: target =>
        target.id === 'test:a' ? firstWorld : secondWorld,
    })

    const box = resolver.resolve([first, second])!

    expect(box.mode).toBe('multi-aabb')
    expect(box.ids).toEqual(['test:a', 'test:b'])
    expect(box.width).toBe(45)
    expect(box.height).toBe(75)
    expectCloseMatrix(box.matrix, [1, 0, 0, 1, 10, 20])
  })
})
