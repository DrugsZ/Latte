import type {
  IDType,
  ITransformService,
  ResizeHandleDirection,
  mat2d,
  vec2,
} from '@latte-js/bean'

interface PendingTransformUpdate {
  notify: () => void
  request: () => Promise<void>
}

interface IActiveTransformInteraction {
  readonly label: string
  readonly ids: IDType[]
  pendingUpdate: PendingTransformUpdate | null
  frameId: number | null
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

  constructor(private readonly _transformService: ITransformService) {}

  public get isActive() {
    return this._active !== null
  }

  public async beginTransform(ids: IDType[], label = 'transform') {
    if (this._active) {
      throw new Error(
        `[TransformInteractionController] Cannot begin ${label} while ${this._active.label} is active`
      )
    }

    await this._transformService.beginTransform(ids, label)
    this._active = {
      label,
      ids: [...ids],
      pendingUpdate: null,
      frameId: null,
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

  public resize(ids: IDType[], width: number, height: number) {
    this._scheduleTransformUpdate({
      notify: () => this._transformService.resize$(ids, width, height),
      request: () => this._transformService.resize(ids, width, height),
    })
  }

  public resizeByHandle(
    ids: IDType[],
    direction: ResizeHandleDirection,
    pointerWorld: vec2
  ) {
    this._scheduleTransformUpdate({
      notify: () =>
        this._transformService.resizeByHandle$(ids, direction, pointerWorld),
      request: () =>
        this._transformService.resizeByHandle(ids, direction, pointerWorld),
    })
  }

  public async commitTransform() {
    if (!this._active) {
      return
    }

    await this._flushPendingUpdate(true)
    await this._transformService.commitTransform()
    this._active = null
  }

  public async cancelTransform() {
    if (!this._active) {
      return
    }

    this._cancelPendingUpdate()
    await this._transformService.cancelTransform()
    this._active = null
  }

  public dispose() {
    this._cancelPendingUpdate()
    this._active = null
  }

  private _scheduleTransformUpdate(update: PendingTransformUpdate) {
    if (!this._active) {
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
