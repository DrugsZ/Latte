import { SceneGraph } from '@latte-js/espresso'
import { describe, expect, it, vi } from 'vitest'

import { Renderer } from '../render'

import {
  DEFAULT_RENDER_CAPABILITIES,
  RenderCommandBuffer,
  RenderCommandType,
} from '../../contract/renderBackend'

import type { IRenderBackendDriver } from '../../contract/renderBackend'
import type { RenderLayer } from '../renderLayer'

const createBackend = () => {
  const size = { width: 100, height: 100, dpr: 1 }
  return {
    type: 'test',
    capabilities: DEFAULT_RENDER_CAPABILITIES,
    init: vi.fn(),
    resize: vi.fn(),
    submit: vi.fn(),
    getSize: () => size,
    dispose: vi.fn(),
    getStats: () => ({
      drawCalls: 0,
      triangles: 0,
      vertices: 0,
      textures: 0,
    }),
    resetStats: vi.fn(),
  } satisfies IRenderBackendDriver
}

const createCommandLayer = (id: string, zIndex: number): RenderLayer => ({
  id,
  zIndex,
  encode() {
    const buffer = new RenderCommandBuffer()
    buffer.push({
      type: RenderCommandType.DrawImage,
      transform: new Float32Array([1, 0, 0, 1, 0, 0]),
      imageId: id,
      dx: 0,
      dy: 0,
      dw: 1,
      dh: 1,
    })
    return buffer
  },
})

describe('Renderer render layers', () => {
  it('submits visible layers by ascending z-index after the scene layer', () => {
    const backend = createBackend()
    const renderer = new Renderer(new SceneGraph(), backend, {
      surface: { type: 'wasm-surface', handle: 1 },
      size: { width: 100, height: 100, dpr: 1 },
      autoStart: false,
    })
    renderer.registerLayer(createCommandLayer('high', 20))
    renderer.registerLayer(createCommandLayer('low', 10))
    ;(renderer as any)._render()

    const submitted = backend.submit.mock.calls.map(([buffer]) => buffer)
    expect(submitted[0].pass.clear).toMatchObject({
      width: 100,
      height: 100,
    })
    expect(
      submitted
        .slice(1)
        .map(buffer => (buffer.commands[0] as { imageId: string }).imageId)
    ).toEqual(['low', 'high'])
  })

  it('hit-tests layers by descending z-index', () => {
    const backend = createBackend()
    const renderer = new Renderer(new SceneGraph(), backend, {
      surface: { type: 'wasm-surface', handle: 1 },
      size: { width: 100, height: 100, dpr: 1 },
      autoStart: false,
    })

    renderer.registerLayer({
      id: 'low',
      zIndex: 10,
      encode: () => null,
      hitTest: () => ({ layerId: 'low', targetId: 'low-target' }),
    })
    renderer.registerLayer({
      id: 'high',
      zIndex: 20,
      encode: () => null,
      hitTest: () => ({ layerId: 'high', targetId: 'high-target' }),
    })

    expect(
      renderer.hitTestLayers({
        viewport: { x: 10, y: 10 },
        world: { x: 10, y: 10 },
      })
    ).toEqual({ layerId: 'high', targetId: 'high-target' })
  })
})
