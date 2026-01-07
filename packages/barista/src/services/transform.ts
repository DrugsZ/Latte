import type { ITransformService, IDType, vec2, mat2d } from '@latte-js/bean'
import { type SceneGraph } from '@latte-js/espresso'
import type { TransformSystem } from '../systems/transformSystem'
import type { AccessSystem } from '../systems/systems'

export class TransformService implements ITransformService {
  private _system: TransformSystem
  constructor(
    private _sceneGraph: SceneGraph,
    accessSystem: AccessSystem
  ) {
    this._system = accessSystem('transform')!
  }

  public async startSession(ids: IDType[]) {
    return this._system.startSession(ids)
  }

  public async endSession() {
    return this._system.endSession()
  }

  public async abortSession() {
    return this._system.endSession()
  }

  public async moveTo(ids: IDType[], delta: vec2) {
    return this._system.moveTo(ids, delta)
  }

  public async moveTo$(ids: IDType[], delta: vec2) {
    return this._system.moveTo(ids, delta)
  }

  public async moveBy(ids: IDType[], delta: vec2) {
    return this._system.moveBy(ids, delta)
  }

  public async moveBy$(ids: IDType[], delta: vec2) {
    return this._system.moveBy(ids, delta)
  }

  public async transformAround(
    ids: IDType[],
    matrixPayload: mat2d,
    pivot: vec2
  ) {
    return this._system.transformAround(ids, matrixPayload, pivot)
  }

  public async transformAround$(
    ids: IDType[],
    matrixPayload: mat2d,
    pivot: vec2
  ) {
    return this._system.transformAround(ids, matrixPayload, pivot)
  }
}
