/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import {
  InputService,
  EventResult,
  type InputMouseEvent,
} from '../InputService'

import type { Renderer } from '@latte-js/art'
import type { SceneGraph } from '@latte-js/espresso'

// Mock HitTester
vi.mock('@latte-js/art', async importOriginal => {
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    HitTester: class {
      hitTest() {
        return 1
      }
    },
  }
})

describe('InputService', () => {
  it('should dispatch events to handlers based on priority', () => {
    // Mock Canvas
    const mockCanvas = {
      addEventListener: vi.fn(),
    } as unknown as HTMLCanvasElement

    // Mock Renderer
    const mockRenderer = {
      canvas: mockCanvas,
      activeRootId: 'root',
      camera: {
        toWorld: vi.fn().mockReturnValue({ x: 100, y: 200 }),
      },
      rTree: {
        search: vi.fn().mockReturnValue([{ id: 1 }]),
      },
    } as unknown as Renderer

    // Mock SceneGraph
    const mockSceneGraph = {
      getUUID: vi.fn().mockReturnValue('node-1'),
      parent: [-1, -1, -1], // Mock parent array, index 1 -> -1 (root)
    } as unknown as SceneGraph

    const inputService = new InputService(mockRenderer, mockSceneGraph)

    const handler1 = {
      id: 'h1',
      priority: 10,
      onEvent: vi.fn().mockReturnValue(EventResult.IGNORED),
    }
    const handler2 = {
      id: 'h2',
      priority: 20,
      onEvent: vi.fn().mockReturnValue(EventResult.CONSUMED),
    }

    inputService.registerHandler(handler1)
    inputService.registerHandler(handler2)

    // Trigger event
    // We need to access the callback passed to addEventListener
    const callback = (mockCanvas.addEventListener as any).mock.calls.find(
      (call: any) => call[0] === 'pointerdown'
    )[1]

    const rawEvent = {
      clientX: 50,
      clientY: 60,
      altKey: false,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
    } as PointerEvent

    callback(rawEvent)

    // Check handler2 called first (priority 20)
    expect(handler2.onEvent).toHaveBeenCalled()
    expect(handler1.onEvent).not.toHaveBeenCalled() // handler2 consumed it

    // Check event data
    const eventArg: InputMouseEvent = (handler2.onEvent as any).mock.calls[0][0]
    expect(eventArg.client.x).toBe(100)
    expect(eventArg.client.y).toBe(200)
    expect(eventArg.hitResult?.nodeIndex).toBe(1)
  })
})
