import type {
  AbsoluteSizeResizeRequest,
  BeginTransformResult,
  IDType,
  ITransformService,
  ResizeRequest,
  ResizeHandleDirection,
  RotateRequest,
  TransformUpdateOperation,
  mat2d,
  vec2,
} from '@latte-js/bean'

interface PendingTransformUpdate {
  readonly operation: TransformUpdateOperation
}

interface IActiveTransformInteraction {
  readonly label: string
  readonly sessionId: string
  readonly ids: IDType[]
  readonly service: ITransformService
  pendingUpdate: PendingTransformUpdate | null
  frameId: number | null
}

interface IPendingTransformBegin {
  readonly service: ITransformService
  cancelRequested: boolean
}

type TransformServiceSource = ITransformService | (() => ITransformService)

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
  private _pendingBegin: IPendingTransformBegin | null = null

  constructor(
    private readonly _transformServiceSource: TransformServiceSource
  ) {}

  public get isActive() {
    return this._active !== null || this._pendingBegin !== null
  }

  public async beginTransform(ids: IDType[], label = 'transform') {
    if (this.isActive) {
      throw new Error(
        `[TransformInteractionController] Cannot begin ${label} while another transform is active`
      )
    }

    const service = this._getTransformService()
    const pending: IPendingTransformBegin = {
      service,
      cancelRequested: false,
    }
    this._pendingBegin = pending

    let session: BeginTransformResult | void
    try {
      session = await service.beginTransform({
        ids,
        operation: 'transform',
        label,
      })
    } catch (error) {
      if (this._pendingBegin === pending) {
        this._pendingBegin = null
      }
      throw error
    }

    if (pending.cancelRequested) {
      try {
        await service.cancelTransform(this._resolveSessionId(session))
      } finally {
        if (this._pendingBegin === pending) {
          this._pendingBegin = null
        }
      }
      throw new Error(
        '[TransformInteractionController] Transform begin canceled'
      )
    }

    this._pendingBegin = null
    this._active = {
      label,
      sessionId: this._resolveSessionId(session),
      ids: [...ids],
      service,
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
    void ids
    this._scheduleTransformUpdate({
      operation: {
        kind: 'move-by',
        delta: this._cloneVec2(totalDelta),
      },
    })
  }

  public moveTo(ids: IDType[], position: vec2) {
    void ids
    this._scheduleTransformUpdate({
      operation: {
        kind: 'move-to',
        position: this._cloneVec2(position),
      },
    })
  }

  public transformAround(ids: IDType[], matrix: mat2d, pivot: vec2) {
    void ids
    this._scheduleTransformUpdate({
      operation: {
        kind: 'transform-around',
        matrixPayload: this._cloneMat2d(matrix),
        pivot: this._cloneVec2(pivot),
      },
    })
  }

  public rotate(ids: IDType[], request: RotateRequest) {
    void ids
    this._scheduleTransformUpdate({
      operation: {
        kind: 'rotate',
        request: this._cloneRotateRequest(request),
      },
    })
  }

  public setSize(ids: IDType[], request: AbsoluteSizeResizeRequest) {
    void ids
    this._scheduleTransformUpdate({
      operation: {
        kind: 'resize',
        request: this._normalizeAbsoluteSizeRequest(request),
      },
    })
  }

  public resize(ids: IDType[], request: ResizeRequest): void
  public resize(ids: IDType[], width: number, height: number): void
  public resize(
    ids: IDType[],
    requestOrWidth: ResizeRequest | number,
    height?: number
  ) {
    void ids
    this._scheduleTransformUpdate({
      operation: {
        kind: 'resize',
        request: this._normalizeResizeRequest(requestOrWidth, height),
      },
    })
  }

  public resizeByHandle(
    ids: IDType[],
    direction: ResizeHandleDirection,
    pointerWorld: vec2
  ) {
    void ids
    this._scheduleTransformUpdate({
      operation: {
        kind: 'resize',
        request: {
          mode: 'handle',
          direction,
          pointerWorld: this._cloneVec2(pointerWorld),
          anchor: 'opposite-handle',
        },
      },
    })
  }

  public async commitTransform() {
    if (!this._active) {
      return
    }

    const sessionId = this._active.sessionId
    await this._flushPendingUpdate(true)
    await this._active.service.commitTransform(sessionId)
    this._active = null
  }

  public async cancelTransform() {
    if (this._pendingBegin) {
      this._pendingBegin.cancelRequested = true
      return
    }

    if (!this._active) {
      return
    }

    this._cancelPendingUpdate()
    await this._active.service.cancelTransform(this._active.sessionId)
    this._active = null
  }

  public dispose() {
    void this.cancelTransform()
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
      await this._active.service.updateTransform({
        sessionId: this._active.sessionId,
        operation: update.operation,
      })
      return
    }

    this._active.service.updateTransform$({
      sessionId: this._active.sessionId,
      operation: update.operation,
    })
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

  private _resolveSessionId(session: BeginTransformResult | void) {
    return session?.sessionId ?? ''
  }

  private _getTransformService() {
    return typeof this._transformServiceSource === 'function'
      ? this._transformServiceSource()
      : this._transformServiceSource
  }

  private _normalizeResizeRequest(
    requestOrWidth: ResizeRequest | number,
    height?: number
  ): ResizeRequest {
    if (typeof requestOrWidth === 'number') {
      return {
        mode: 'absolute-size',
        width: requestOrWidth,
        height,
        anchor: 'local-origin',
      }
    }

    if (requestOrWidth.mode === 'absolute-size') {
      return this._normalizeAbsoluteSizeRequest(requestOrWidth)
    }

    return {
      mode: 'handle',
      direction: requestOrWidth.direction,
      pointerWorld: this._cloneVec2(requestOrWidth.pointerWorld),
      anchor: 'opposite-handle',
    }
  }

  private _normalizeAbsoluteSizeRequest(
    request: AbsoluteSizeResizeRequest
  ): ResizeRequest {
    return {
      mode: 'absolute-size',
      width: request.width,
      height: request.height,
      anchor: request.anchor ?? 'local-origin',
    }
  }

  private _cloneRotateRequest(request: RotateRequest): RotateRequest {
    if (request.mode === 'absolute') {
      return { ...request }
    }

    return {
      ...request,
      pivot:
        request.pivot === 'interaction-group-center'
          ? request.pivot
          : {
              kind: 'world-point',
              point: this._cloneVec2(request.pivot.point),
            },
    }
  }

  private _cloneVec2(value: vec2): vec2 {
    return [value[0], value[1]]
  }

  private _cloneMat2d(value: mat2d): mat2d {
    return [value[0], value[1], value[2], value[3], value[4], value[5]]
  }
}
