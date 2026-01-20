import {
  Channels,
  type ITransformService,
  type IDType,
  type vec2,
  type mat2d,
} from '@latte-js/bean'
import { ServiceBase, type IContext, service } from './serviceBase'
import type { TransformSystem } from '../systems/transformSystem'

@service()
export class TransformService
  extends ServiceBase<TransformSystem>
  implements ITransformService
{
  readonly channelName = Channels.Transform

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
