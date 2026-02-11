// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { InputService } from '../input/inputService'

// Mock HitTester
vi.mock('@latte-js/art', async importOriginal => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    HitTester: class {
      hitTest = vi.fn().mockReturnValue(1)
    },
    // Mock Renderer class if needed, but we pass instance mock
  }
})

describe('InputService', () => {
  let inputService: InputService
  let mockRenderer: any
  let mockSceneGraph: any
  let mockCanvas: any

  beforeEach(() => {
    // Setup DOM environment mocks
    mockCanvas = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0 }),
    }

    mockRenderer = {
      canvas: mockCanvas,
      camera: {
        toWorld: vi.fn().mockReturnValue({ x: 0, y: 0 }),
      },
      activeRootId: 'root',
      rTree: {
        search: vi.fn().mockReturnValue([]),
      },
    } as any

    mockSceneGraph = {
      getUUID: vi.fn().mockReturnValue('node-id'),
    } as any

    inputService = new InputService(mockRenderer, mockSceneGraph)
  })

  afterEach(() => {
    inputService.dispose()
    vi.clearAllMocks()
  })

  it('should register event listeners on init', () => {
    expect(mockCanvas.addEventListener).toHaveBeenCalledWith(
      'pointerdown',
      expect.any(Function)
    )
    expect(mockCanvas.addEventListener).toHaveBeenCalledWith(
      'pointermove',
      expect.any(Function)
    )
    expect(mockCanvas.addEventListener).toHaveBeenCalledWith(
      'pointerup',
      expect.any(Function)
    )
    expect(mockCanvas.addEventListener).toHaveBeenCalledWith(
      'wheel',
      expect.any(Function),
      { passive: false }
    )
  })

  it('should register and execute handlers', () => {
    const handler = {
      id: 'test',
      priority: 10,
      onEvent: vi.fn(),
    }

    inputService.registerHandler(handler)

    // Trigger an event manually if we can access the private listener
    // Or just check if handler is stored (private _handlers)
    // Since we can't easily access private members, we rely on behavior.

    // Let's try to simulate the event by calling the listener passed to addEventListener
    // We need to capture the listener function
    const pointerDownCall = mockCanvas.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === 'pointerdown'
    )
    const listener = pointerDownCall[1]

    const mockEvent = {
      type: 'pointerdown',
      clientX: 10,
      clientY: 10,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }

    listener(mockEvent)

    expect(handler.onEvent).toHaveBeenCalled()
  })

  it('should remove handlers', () => {
    const handler = {
      id: 'test',
      priority: 10,
      onEvent: vi.fn(),
    }
    inputService.registerHandler(handler)
    inputService.removeHandler('test')

    // Simulate event
    const pointerDownCall = mockCanvas.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === 'pointerdown'
    )
    const listener = pointerDownCall[1]

    const mockEvent = {
      type: 'pointerdown',
      clientX: 10,
      clientY: 10,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }

    listener(mockEvent)

    expect(handler.onEvent).not.toHaveBeenCalled()
  })

  it('should handle keyboard events', () => {
    const onKeyDownSpy = vi.fn()
    inputService.onKeyDown(onKeyDownSpy)

    // Simulate window keydown
    const event = new KeyboardEvent('keydown', { key: 'Enter' })
    window.dispatchEvent(event)

    expect(onKeyDownSpy).toHaveBeenCalledWith(event)
  })
})
