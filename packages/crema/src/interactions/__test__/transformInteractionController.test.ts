import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TransformInteractionController } from '../transformInteractionController'

describe('TransformInteractionController', () => {
  let transformService: any

  beforeEach(() => {
    vi.useFakeTimers()
    transformService = {
      beginTransform: vi.fn().mockResolvedValue({
        sessionId: 'doc:a',
        baseRevision: 7,
        groupBox: null,
      }),
      updateTransform: vi.fn().mockResolvedValue(undefined),
      updateTransform$: vi.fn(),
      commitTransform: vi.fn().mockResolvedValue(undefined),
      cancelTransform: vi.fn().mockResolvedValue(undefined),
      moveBy: vi.fn().mockResolvedValue(undefined),
      moveBy$: vi.fn(),
      moveTo: vi.fn().mockResolvedValue(undefined),
      moveTo$: vi.fn(),
      resize: vi.fn().mockResolvedValue(undefined),
      resize$: vi.fn(),
      resizeByHandle: vi.fn().mockResolvedValue(undefined),
      resizeByHandle$: vi.fn(),
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

    expect(transformService.updateTransform$).toHaveBeenCalledTimes(1)
    expect(transformService.updateTransform$).toHaveBeenCalledWith({
      sessionId: 'doc:a',
      operation: { kind: 'move-by', delta: [5, 8] },
    })
    expect(transformService.moveBy$).not.toHaveBeenCalled()
  })

  it('coalesces world-position targets without replaying intermediate positions', async () => {
    const controller = new TransformInteractionController(transformService)

    await controller.beginTransform(['test:rect'])
    controller.moveTo(['test:rect'], [10, 20])
    controller.moveTo(['test:rect'], [50, 80])

    vi.advanceTimersByTime(16)

    expect(transformService.updateTransform$).toHaveBeenCalledTimes(1)
    expect(transformService.updateTransform$).toHaveBeenCalledWith({
      sessionId: 'doc:a',
      operation: { kind: 'move-to', position: [50, 80] },
    })
    expect(transformService.moveTo$).not.toHaveBeenCalled()
  })

  it('flushes pending update before committing the transform interaction', async () => {
    const controller = new TransformInteractionController(transformService)

    await controller.beginTransform(['test:rect'])
    controller.moveBy(['test:rect'], [2, 3])
    await controller.commitTransform()

    expect(transformService.updateTransform).toHaveBeenCalledWith({
      sessionId: 'doc:a',
      operation: { kind: 'move-by', delta: [2, 3] },
    })
    expect(transformService.updateTransform$).not.toHaveBeenCalled()
    expect(transformService.moveBy).not.toHaveBeenCalled()
    expect(transformService.commitTransform).toHaveBeenCalledWith('doc:a')
    expect(
      transformService.updateTransform.mock.invocationCallOrder[0]
    ).toBeLessThan(transformService.commitTransform.mock.invocationCallOrder[0])
  })

  it('coalesces resize updates and flushes the final size on commit', async () => {
    const controller = new TransformInteractionController(transformService)

    await controller.beginTransform(['test:rect'])
    controller.resize(['test:rect'], 120, 80)
    controller.resize(['test:rect'], 140, 90)

    vi.advanceTimersByTime(16)

    expect(transformService.updateTransform$).toHaveBeenCalledTimes(1)
    expect(transformService.updateTransform$).toHaveBeenCalledWith({
      sessionId: 'doc:a',
      operation: {
        kind: 'resize',
        request: {
          mode: 'absolute-size',
          width: 140,
          height: 90,
          anchor: 'local-origin',
        },
      },
    })
    expect(transformService.resize$).not.toHaveBeenCalled()

    controller.resize(['test:rect'], 160, 100)
    await controller.commitTransform()

    expect(transformService.updateTransform).toHaveBeenCalledWith({
      sessionId: 'doc:a',
      operation: {
        kind: 'resize',
        request: {
          mode: 'absolute-size',
          width: 160,
          height: 100,
          anchor: 'local-origin',
        },
      },
    })
    expect(transformService.resize).not.toHaveBeenCalled()
    expect(transformService.commitTransform).toHaveBeenCalledWith('doc:a')
  })

  it('coalesces resize-by-handle updates and flushes the final pointer target on commit', async () => {
    const controller = new TransformInteractionController(transformService)

    await controller.beginTransform(['test:rect'])
    controller.resizeByHandle(['test:rect'], 'se', [120, 80])
    controller.resizeByHandle(['test:rect'], 'se', [140, 90])

    vi.advanceTimersByTime(16)

    expect(transformService.updateTransform$).toHaveBeenCalledTimes(1)
    expect(transformService.updateTransform$).toHaveBeenCalledWith({
      sessionId: 'doc:a',
      operation: {
        kind: 'resize',
        request: {
          mode: 'handle',
          direction: 'se',
          pointerWorld: [140, 90],
          anchor: 'opposite-handle',
        },
      },
    })
    expect(transformService.resizeByHandle$).not.toHaveBeenCalled()

    controller.resizeByHandle(['test:rect'], 'se', [160, 100])
    await controller.commitTransform()

    expect(transformService.updateTransform).toHaveBeenCalledWith({
      sessionId: 'doc:a',
      operation: {
        kind: 'resize',
        request: {
          mode: 'handle',
          direction: 'se',
          pointerWorld: [160, 100],
          anchor: 'opposite-handle',
        },
      },
    })
    expect(transformService.resizeByHandle).not.toHaveBeenCalled()
    expect(transformService.commitTransform).toHaveBeenCalledWith('doc:a')
  })

  it('drops pending update before canceling the transform interaction', async () => {
    const controller = new TransformInteractionController(transformService)

    await controller.beginTransform(['test:rect'])
    controller.moveBy(['test:rect'], [2, 3])
    await controller.cancelTransform()

    expect(transformService.updateTransform$).not.toHaveBeenCalled()
    expect(transformService.cancelTransform).toHaveBeenCalledWith('doc:a')
  })

  it('cancels a pending begin through the service captured for that document', async () => {
    let resolveBegin!: (value: {
      sessionId: string
      baseRevision: number
      groupBox: null
    }) => void
    const serviceA = {
      ...transformService,
      beginTransform: vi.fn(
        () =>
          new Promise(resolve => {
            resolveBegin = resolve
          })
      ),
      cancelTransform: vi.fn().mockResolvedValue(undefined),
    }
    const serviceB = {
      ...transformService,
      cancelTransform: vi.fn().mockResolvedValue(undefined),
    }
    let currentService = serviceA
    const controller = new TransformInteractionController(() => currentService)

    const beginTask = controller.beginTransform(['test:rect'])
    expect(controller.isActive).toBe(true)

    await controller.cancelTransform()
    currentService = serviceB
    resolveBegin({ sessionId: 'transform:a', baseRevision: 8, groupBox: null })

    await expect(beginTask).rejects.toThrow('Transform begin canceled')
    expect(serviceA.cancelTransform).toHaveBeenCalledWith('transform:a')
    expect(serviceB.cancelTransform).not.toHaveBeenCalled()
    expect(controller.isActive).toBe(false)
  })

  it('cancels an active worker transform session when disposed', async () => {
    const controller = new TransformInteractionController(transformService)

    await controller.beginTransform(['test:rect'])
    controller.moveBy(['test:rect'], [2, 3])
    controller.dispose()
    await Promise.resolve()

    vi.advanceTimersByTime(16)

    expect(transformService.updateTransform$).not.toHaveBeenCalled()
    expect(transformService.cancelTransform).toHaveBeenCalledWith('doc:a')
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
    expect(transformService.beginTransform).toHaveBeenCalledWith({
      ids: ['test:rect'],
      operation: 'transform',
      label: 'Move Layer',
    })
    expect(transformService.updateTransform).toHaveBeenCalledWith({
      sessionId: 'doc:a',
      operation: { kind: 'move-by', delta: [8, 13] },
    })
    expect(transformService.moveBy).not.toHaveBeenCalled()
    expect(transformService.commitTransform).toHaveBeenCalledWith('doc:a')
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

    expect(transformService.updateTransform).not.toHaveBeenCalled()
    expect(transformService.updateTransform$).not.toHaveBeenCalled()
    expect(transformService.cancelTransform).toHaveBeenCalledWith('doc:a')
  })
})
