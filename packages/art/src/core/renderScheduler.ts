export enum RenderReason {
  Manual = 'manual',
  CameraChanged = 'camera-changed',
  Resize = 'resize',
  ActiveRootChanged = 'active-root-changed',
  GraphChanged = 'graph-changed',
  SceneDirty = 'scene-dirty',
}

export type RenderRequestReason = RenderReason | string

export class RenderScheduler {
  private readonly _reasons = new Set<RenderRequestReason>()

  public request(reason: RenderRequestReason = RenderReason.Manual) {
    this._reasons.add(reason)
  }

  public get hasPending() {
    return this._reasons.size > 0
  }

  public consume() {
    const reasons = [...this._reasons]
    this._reasons.clear()
    return reasons
  }

  public clear() {
    this._reasons.clear()
  }
}
