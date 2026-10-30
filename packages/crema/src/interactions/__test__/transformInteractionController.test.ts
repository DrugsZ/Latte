import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TransformInteractionController } from '../transformInteractionController'

describe('TransformInteractionController', () => {
  let transformService: any

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
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces transform updates to the latest frame update', async () => {
    const controller = new TransformInteractionController(transformService)

    await controller.beginTransform(['test:rect'])
    controller.moveBy(['test:rect'], [1, 1])
    controller.moveBy(['test:rect'], [5, 8])

    vi.advanceTimersByTime(16)

    expect(transformService.moveBy$).toHaveBeenCalledTimes(1)
    expect(transformService.moveBy$).toHaveBeenCalledWith(['test:rect'], [5, 8])
  })

  it('coalesces world-position targets without replaying intermediate positions', async () => {
    const controller = new TransformInteractionController(transformService)

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
    const controller = new TransformInteractionController(transformService)

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
    const controller = new TransformInteractionController(transformService)

    await controller.beginTransform(['test:rect'])
    controller.moveBy(['test:rect'], [2, 3])
    await controller.cancelTransform()

    expect(transformService.moveBy$).not.toHaveBeenCalled()
    expect(transformService.cancelTransform).toHaveBeenCalledTimes(1)
  })

  it('runTransform commits a successful interaction', async () => {
    const controller = new TransformInteractionController(transformService)

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
    const controller = new TransformInteractionController(transformService)

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

  it('reserves the interaction while worker begin acknowledgement is pending', async () => {
    let completeBegin!: () => void
    transformService.beginTransform.mockReturnValue(
      new Promise<void>(resolve => {
        completeBegin = resolve
      })
    )
    const controller = new TransformInteractionController(transformService)
    const beginning = controller.beginTransform(['test:rect'])

    expect(controller.isActive).toBe(true)
    await expect(controller.beginTransform(['test:other'])).rejects.toThrow(
      'Cannot begin'
    )
    expect(transformService.beginTransform).toHaveBeenCalledTimes(1)
    completeBegin()
    await beginning
    await controller.cancelTransform()
  })

  it('shares one commit request for duplicate end calls', async () => {
    let completeCommit!: () => void
    transformService.commitTransform.mockReturnValue(
      new Promise<void>(resolve => {
        completeCommit = resolve
      })
    )
    const controller = new TransformInteractionController(transformService)
    await controller.beginTransform(['test:rect'])
    const first = controller.commitTransform()
    const second = controller.commitTransform()
    await Promise.resolve()
    await Promise.resolve()

    expect(transformService.commitTransform).toHaveBeenCalledTimes(1)
    expect(() => controller.moveBy(['test:rect'], [1, 1])).toThrow(
      'beginTransform'
    )
    completeCommit()
    await Promise.all([first, second])
    expect(controller.isActive).toBe(false)
  })

  it('allows cancellation to recover from a rejected commit', async () => {
    transformService.commitTransform.mockRejectedValueOnce(
      new Error('commit failed')
    )
    const controller = new TransformInteractionController(transformService)
    await controller.beginTransform(['test:rect'])
    await expect(controller.commitTransform()).rejects.toThrow('commit failed')
    await controller.cancelTransform()
    expect(transformService.cancelTransform).toHaveBeenCalledTimes(1)
    expect(controller.isActive).toBe(false)
  })

  it('cancels a begin acknowledgement arriving after disposal', async () => {
    let completeBegin!: () => void
    transformService.beginTransform.mockReturnValue(
      new Promise<void>(resolve => {
        completeBegin = resolve
      })
    )
    const controller = new TransformInteractionController(transformService)
    const beginning = controller.beginTransform(['test:rect'])
    controller.dispose()
    completeBegin()
    await beginning
    expect(transformService.cancelTransform).toHaveBeenCalledTimes(1)
    expect(controller.isActive).toBe(false)
    await expect(controller.beginTransform(['test:rect'])).rejects.toThrow(
      'disposed'
    )
  })
})
