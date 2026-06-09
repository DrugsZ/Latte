import {
  Channels,
  type IDType,
  type ITransformService,
  type mat2d,
  type vec2,
} from '@latte-js/bean'

import { service, ServiceBase, type IContext } from './serviceBase'

import type { TransformSystem } from '../systems/transform'
import {
  MutationPolicyKind,
  type MutationPolicyMap,
} from '../transactions/mutationPolicy'

const idsFromFirstArg = (args: readonly unknown[]) => args[0] as IDType[]

const transformServiceMutationPolicies: MutationPolicyMap = {
  beginTransform: {
    kind: MutationPolicyKind.SessionBegin,
    label: args => (typeof args[1] === 'string' ? args[1] : 'Transform Layer'),
    ids: idsFromFirstArg,
  },
  commitTransform: { kind: MutationPolicyKind.SessionCommit },
  cancelTransform: { kind: MutationPolicyKind.SessionCancel },
  moveTo$: { kind: MutationPolicyKind.SessionMutation },
  moveBy$: { kind: MutationPolicyKind.SessionMutation },
  transformAround$: { kind: MutationPolicyKind.SessionMutation },
}

@service({ mutations: transformServiceMutationPolicies })
export class TransformService
  extends ServiceBase<TransformSystem>
  implements ITransformService
{
  public static readonly name = Channels.Transform

  constructor(ctx: IContext) {
    super(ctx)
  }

  public async beginTransform(_ids: IDType[], _label = 'Transform Layer') {}

  public async commitTransform() {}

  public async cancelTransform() {}

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
