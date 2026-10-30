import type { IDType, ITransformService, mat2d, vec2 } from '@latte-js/bean'

interface PendingTransformUpdate {
  notify: () => void
  request: () => Promise<void>
}

interface IActiveTransformInteraction {
  readonly label: string
  readonly ids: IDType[]
  pendingUpdate: PendingTransformUpdate | null
  frameId: number | null
  ready: boolean
  begin: Promise<void>
  finish: Promise<void> | null
}

export type TransformInteractionCallback<T> = (
  controller: TransformInteractionController
) => T | Promise<T>

const requestFrame = (callback: FrameRequestCallback) => {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(callback)
  }
  return setTimeout(() => callback(Date.now()), 16) as unknown as number
}

const cancelFrame = (frameId: number) => {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(frameId)
    return
  }
  clearTimeout(frameId)
}

export class TransformInteractionController {
  private _active: IActiveTransformInteraction | null = null
  private _disposed = false

  constructor(private readonly _transformService: ITransformService) {}

  public get isActive() {
    return this._active !== null
  }

  public async beginTransform(ids: IDType[], label = 'transform') {
    if (this._disposed) {
      throw new Error('[TransformInteractionController] Controller is disposed')
    }
    if (this._active) {
      throw new Error(
        `[TransformInteractionController] Cannot begin ${label} while ${this._active.label} is active`
      )
    }

    const active: IActiveTransformInteraction = {
      label,
      ids: [...ids],
      pendingUpdate: null,
      frameId: null,
      ready: false,
      begin: Promise.resolve(),
      finish: null,
    }
    this._active = active
    try {
      active.begin = this._transformService.beginTransform(ids, label)
      await active.begin
      if (this._active !== active) {
        await this._transformService.cancelTransform()
        return
      }
      active.ready = true
    } catch (error) {
      if (this._active === active) {
        this._active = null
      }
      throw error
    }
  }

  public async runTransform<T>(
    label: string,
    callback: TransformInteractionCallback<T>,
    ids: IDType[] = []
  ): Promise<T> {
    await this.beginTransform(ids, label)

    try {
      const result = await callback(this)
      await this.commitTransform()
      return result
    } catch (error) {
      if (this.isActive) {
        await this.cancelTransform()
      }
      throw error
    }
  }

  public moveBy(ids: IDType[], totalDelta: vec2) {
    this._scheduleTransformUpdate({
      notify: () => this._transformService.moveBy$(ids, totalDelta),
      request: () => this._transformService.moveBy(ids, totalDelta),
    })
  }

  public moveTo(ids: IDType[], position: vec2) {
    this._scheduleTransformUpdate({
      notify: () => this._transformService.moveTo$(ids, position),
      request: () => this._transformService.moveTo(ids, position),
    })
  }

  public transformAround(ids: IDType[], matrix: mat2d, pivot: vec2) {
    this._scheduleTransformUpdate({
      notify: () => this._transformService.transformAround$(ids, matrix, pivot),
      request: () => this._transformService.transformAround(ids, matrix, pivot),
    })
  }

  public commitTransform(): Promise<void> {
    const active = this._active
    if (!active) {
      return Promise.resolve()
    }
    if (active.finish) {
      return active.finish
    }
    active.finish = (async () => {
      await active.begin
      if (this._active !== active) return
      await this._flushPendingUpdate(true)
      await this._transformService.commitTransform()
      if (this._active === active) this._active = null
    })().finally(() => {
      active.finish = null
    })
    return active.finish
  }

  public cancelTransform(): Promise<void> {
    const active = this._active
    if (!active) {
      return Promise.resolve()
    }
    if (active.finish) {
      return active.finish
    }
    this._cancelPendingUpdate()
    active.finish = (async () => {
      await active.begin
      if (this._active !== active) return
      await this._transformService.cancelTransform()
      if (this._active === active) this._active = null
    })().finally(() => {
      active.finish = null
    })
    return active.finish
  }

  public dispose() {
    this._disposed = true
    const active = this._active
    this._cancelPendingUpdate()
    this._active = null
    if (active?.ready && !active.finish) {
      void this._transformService.cancelTransform().catch(error => {
        console.error(
          '[TransformInteractionController] Failed to cancel on dispose',
          error
        )
      })
    }
  }

  private _scheduleTransformUpdate(update: PendingTransformUpdate) {
    if (!this._active?.ready || this._active.finish) {
      throw new Error(
        '[TransformInteractionController] beginTransform must be called before transform updates'
      )
    }

    this._active.pendingUpdate = update
    if (this._active.frameId !== null) {
      return
    }

    this._active.frameId = requestFrame(() => {
      void this._flushPendingUpdate()
    })
  }

  private async _flushPendingUpdate(awaitAck = false) {
    if (!this._active) {
      return
    }

    if (this._active.frameId !== null) {
      cancelFrame(this._active.frameId)
      this._active.frameId = null
    }

    const update = this._active.pendingUpdate
    this._active.pendingUpdate = null
    if (!update) {
      return
    }

    if (awaitAck) {
      await update.request()
      return
    }

    update.notify()
  }

  private _cancelPendingUpdate() {
    if (!this._active) {
      return
    }

    if (this._active.frameId !== null) {
      cancelFrame(this._active.frameId)
      this._active.frameId = null
    }
    this._active.pendingUpdate = null
  }
}
