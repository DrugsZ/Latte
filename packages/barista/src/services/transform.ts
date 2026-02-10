import {
  Channels,
  type IDType,
  type ITransformService,
  type mat2d,
  type vec2,
} from '@latte-js/bean'

import { service, ServiceBase, type IContext } from './serviceBase'

import type { TransformSystem } from '../systems/transform'

@service
export class TransformService
  extends ServiceBase<TransformSystem>
  implements ITransformService
{
  public static readonly name = Channels.Transform

  constructor(ctx: IContext) {
    super(ctx)
  }

  public async startSession(ids: IDType[]) {
    return this.system.startSession(ids)
  }

  public async endSession() {
    return this.system.endSession()
  }

  public async abortSession() {
    return this.system.endSession()
  }

  public async moveTo(ids: IDType[], delta: vec2) {
    return this.system.moveTo(ids, delta)
  }

  public async moveTo$(ids: IDType[], delta: vec2) {
    return this.system.moveTo(ids, delta)
  }

  public async moveBy(ids: IDType[], delta: vec2) {
    return this.system.moveBy(ids, delta)
  }

  public async moveBy$(ids: IDType[], delta: vec2) {
    return this.system.moveBy(ids, delta)
  }

  public async transformAround(
    ids: IDType[],
    matrixPayload: mat2d,
    pivot: vec2
  ) {
    return this.system.transformAround(ids, matrixPayload, pivot)
  }

  public async transformAround$(
    ids: IDType[],
    matrixPayload: mat2d,
    pivot: vec2
  ) {
    return this.system.transformAround(ids, matrixPayload, pivot)
  }
}
