import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RuntimeInteractionController } from '../runtimeInteractionController'

describe('RuntimeInteractionController', () => {
  let transformService: any
  let undoRedoService: any

  beforeEach(() => {
    vi.useFakeTimers()
    transformService = {
      beginTransform: vi.fn().mockResolvedValue(undefined),
      commitTransform: vi.fn().mockResolvedValue(undefined),
      cancelTransform: vi.fn().mockResolvedValue(undefined),
      moveBy: vi.fn().mockResolvedValue(undefined),
      moveBy$: vi.fn(),
      moveTo: vi.fn().mockResolvedValue(undefined),
      moveTo$: vi.fn(),
      transformAround: vi.fn().mockResolvedValue(undefined),
      transformAround$: vi.fn(),
    }
    undoRedoService = {
      undo: vi.fn().mockResolvedValue(true),
      redo: vi.fn().mockResolvedValue(true),
      canUndo: vi.fn().mockResolvedValue(true),
      canRedo: vi.fn().mockResolvedValue(false),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces transform updates to the latest frame update', async () => {
    const controller = new RuntimeInteractionController(
      transformService,
      undoRedoService
    )

    await controller.beginTransform(['test:rect'])
    controller.moveBy(['test:rect'], [1, 1])
    controller.moveBy(['test:rect'], [5, 8])

    vi.advanceTimersByTime(16)

    expect(transformService.moveBy$).toHaveBeenCalledTimes(1)
    expect(transformService.moveBy$).toHaveBeenCalledWith(['test:rect'], [5, 8])
  })

  it('coalesces world-position targets without replaying intermediate positions', async () => {
    const controller = new RuntimeInteractionController(
      transformService,
      undoRedoService
    )

    await controller.beginTransform(['test:rect'])
    controller.moveTo(['test:rect'], [10, 20])
    controller.moveTo(['test:rect'], [50, 80])

    vi.advanceTimersByTime(16)

    expect(transformService.moveTo$).toHaveBeenCalledTimes(1)
    expect(transformService.moveTo$).toHaveBeenCalledWith(
      ['test:rect'],
      [50, 80]
    )
  })

  it('flushes pending update before committing the transform interaction', async () => {
    const controller = new RuntimeInteractionController(
      transformService,
      undoRedoService
    )

    await controller.beginTransform(['test:rect'])
    controller.moveBy(['test:rect'], [2, 3])
    await controller.commitTransform()

    expect(transformService.moveBy).toHaveBeenCalledWith(['test:rect'], [2, 3])
    expect(transformService.moveBy$).not.toHaveBeenCalled()
    expect(transformService.commitTransform).toHaveBeenCalledTimes(1)
    expect(transformService.moveBy.mock.invocationCallOrder[0]).toBeLessThan(
      transformService.commitTransform.mock.invocationCallOrder[0]
    )
  })

  it('drops pending update before canceling the transform interaction', async () => {
    const controller = new RuntimeInteractionController(
      transformService,
      undoRedoService
    )

    await controller.beginTransform(['test:rect'])
    controller.moveBy(['test:rect'], [2, 3])
    await controller.cancelTransform()

    expect(transformService.moveBy$).not.toHaveBeenCalled()
    expect(transformService.cancelTransform).toHaveBeenCalledTimes(1)
  })

  it('delegates history controls to the undo/redo service', async () => {
    const controller = new RuntimeInteractionController(
      transformService,
      undoRedoService
    )

    await expect(controller.undo()).resolves.toBe(true)
    await expect(controller.redo()).resolves.toBe(true)
    await expect(controller.canUndo()).resolves.toBe(true)
    await expect(controller.canRedo()).resolves.toBe(false)
  })

  it('runTransform commits a successful interaction', async () => {
    const controller = new RuntimeInteractionController(
      transformService,
      undoRedoService
    )

    const result = await controller.runTransform(
      'Move Layer',
      interaction => {
        interaction.moveBy(['test:rect'], [8, 13])
        return 'ok'
      },
      ['test:rect']
    )

    expect(result).toBe('ok')
    expect(transformService.beginTransform).toHaveBeenCalledWith(
      ['test:rect'],
      'Move Layer'
    )
    expect(transformService.moveBy).toHaveBeenCalledWith(['test:rect'], [8, 13])
    expect(transformService.commitTransform).toHaveBeenCalledTimes(1)
  })

  it('runTransform cancels when the callback fails', async () => {
    const controller = new RuntimeInteractionController(
      transformService,
      undoRedoService
    )

    await expect(
      controller.runTransform(
        'transform',
        interaction => {
          interaction.moveBy(['test:rect'], [8, 13])
          throw new Error('boom')
        },
        ['test:rect']
      )
    ).rejects.toThrow('boom')

    expect(transformService.moveBy).not.toHaveBeenCalled()
    expect(transformService.moveBy$).not.toHaveBeenCalled()
    expect(transformService.cancelTransform).toHaveBeenCalledTimes(1)
  })
})
