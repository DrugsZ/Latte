// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EventResult, InputService } from '../input/inputService'

describe('InputService', () => {
  let inputService: InputService
  let mockCanvas: any
  let hitTestService: any

  beforeEach(() => {
    // Setup DOM environment mocks
    mockCanvas = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0 }),
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn().mockReturnValue(true),
      releasePointerCapture: vi.fn(),
    }

    hitTestService = {
      hitTest: vi.fn().mockReturnValue({
        hitResult: undefined,
        viewport: { x: 10, y: 10 },
        world: { x: 0, y: 0 },
      }),
    }

    inputService = new InputService(mockCanvas, hitTestService)
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
      onEvent: vi.fn(() => EventResult.IGNORED),
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
    expect(hitTestService.hitTest).toHaveBeenCalledWith(10, 10)
  })

  it('should stop dispatching when an event stops propagation', () => {
    const first = {
      id: 'first',
      priority: 20,
      onEvent: vi.fn(e => {
        e.stopPropagation()
        return EventResult.IGNORED
      }),
    }
    const second = {
      id: 'second',
      priority: 10,
      onEvent: vi.fn(() => EventResult.IGNORED),
    }

    inputService.registerHandler(first)
    inputService.registerHandler(second)

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

    expect(first.onEvent).toHaveBeenCalled()
    expect(second.onEvent).not.toHaveBeenCalled()
    expect(mockEvent.stopPropagation).toHaveBeenCalled()
    expect(mockEvent.preventDefault).not.toHaveBeenCalled()
  })

  it('should dispatch captured pointer events to the capture owner', () => {
    const captureOwner = {
      id: 'capture-owner',
      priority: 10,
      onEvent: vi.fn(e => {
        if (e.browserEvent.type === 'pointerdown') {
          e.capturePointer()
        }
        return EventResult.IGNORED
      }),
    }
    const higherPriority = {
      id: 'higher-priority',
      priority: 20,
      onEvent: vi.fn(() => EventResult.IGNORED),
    }

    inputService.registerHandler(higherPriority)
    inputService.registerHandler(captureOwner)

    const getListener = (type: string) =>
      mockCanvas.addEventListener.mock.calls.find(
        (call: any[]) => call[0] === type
      )[1]

    getListener('pointerdown')({
      type: 'pointerdown',
      pointerId: 1,
      clientX: 10,
      clientY: 10,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    })

    higherPriority.onEvent.mockClear()
    captureOwner.onEvent.mockClear()

    getListener('pointermove')({
      type: 'pointermove',
      pointerId: 1,
      clientX: 20,
      clientY: 20,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    })

    expect(captureOwner.onEvent).toHaveBeenCalledTimes(1)
    expect(higherPriority.onEvent).not.toHaveBeenCalled()
  })

  it('should remove handlers', () => {
    const handler = {
      id: 'test',
      priority: 10,
      onEvent: vi.fn(() => EventResult.IGNORED),
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

  it('captures the native pointer so moves and releases continue outside the canvas', () => {
    inputService.capturePointer(7, 'drag')
    expect(mockCanvas.setPointerCapture).toHaveBeenCalledWith(7)
    inputService.releasePointer(7, 'another-handler')
    expect(mockCanvas.releasePointerCapture).not.toHaveBeenCalled()
    inputService.releasePointer(7, 'drag')
    expect(mockCanvas.releasePointerCapture).toHaveBeenCalledWith(7)
  })

  it('allows an async capture failure to release the original event pointer', async () => {
    let event: any
    inputService.registerHandler({
      id: 'drag',
      priority: 1,
      onEvent: e => {
        event = e
        e.capturePointer()
        return EventResult.CONSUMED
      },
    })
    const listener = mockCanvas.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === 'pointerdown'
    )[1]
    listener({
      type: 'pointerdown',
      pointerId: 8,
      clientX: 0,
      clientY: 0,
      preventDefault: vi.fn(),
    })

    await Promise.resolve()
    event.releasePointer()
    expect(mockCanvas.releasePointerCapture).toHaveBeenCalledWith(8)
  })

  it('cancels the owning gesture when native pointer capture is lost', () => {
    const onEvent = vi.fn((e: any) => EventResult.CONSUMED)
    inputService.registerHandler({ id: 'drag', priority: 1, onEvent })
    inputService.capturePointer(9, 'drag')
    const listener = mockCanvas.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === 'lostpointercapture'
    )[1]
    listener({ pointerId: 9, clientX: 20, clientY: 30 })

    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent.mock.calls[0][0].browserEvent.type).toBe('pointercancel')
    expect(onEvent.mock.calls[0][0].pointerId).toBe(9)
    expect(mockCanvas.releasePointerCapture).toHaveBeenCalledWith(9)
    listener({ pointerId: 9, clientX: 20, clientY: 30 })
    expect(onEvent).toHaveBeenCalledTimes(1)
  })

  it('releases native capture when its owner is removed', () => {
    inputService.capturePointer(10, 'drag')
    inputService.removeHandler('drag')
    expect(mockCanvas.releasePointerCapture).toHaveBeenCalledWith(10)
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
