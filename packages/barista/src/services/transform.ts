import {
  Channels,
  type AbsoluteSizeResizeRequest,
  type IDType,
  type ITransformService,
  type ResizeHandleDirection,
  type RotateRequest,
  type mat2d,
  type vec2,
} from '@latte-js/bean'

import { Service, SystemBackedServiceBase, type IContext } from './serviceBase'

import type { TransformSystem } from '../systems/transform'
import { Systems } from '../systems'
import {
  MutationPolicyKind,
  type MutationPolicyMap,
} from '../transactions/mutationPolicy'
import { TransactionLabel } from '../transactions/transactionLabels'

const idsFromFirstArg = (args: readonly unknown[]) => args[0] as IDType[]

const transformServiceMutationPolicies: MutationPolicyMap = {
  beginTransform: {
    kind: MutationPolicyKind.SessionBegin,
    label: args =>
      typeof args[1] === 'string' ? args[1] : TransactionLabel.TransformLayer,
    ids: idsFromFirstArg,
  },
  commitTransform: { kind: MutationPolicyKind.SessionCommit },
  cancelTransform: { kind: MutationPolicyKind.SessionCancel },
  moveTo$: { kind: MutationPolicyKind.SessionMutation },
  moveBy$: { kind: MutationPolicyKind.SessionMutation },
  transformAround$: { kind: MutationPolicyKind.SessionMutation },
  rotate$: { kind: MutationPolicyKind.SessionMutation },
  setSize$: { kind: MutationPolicyKind.SessionMutation },
  resize$: { kind: MutationPolicyKind.SessionMutation },
  resizeByHandle$: { kind: MutationPolicyKind.SessionMutation },
}

@Service({
  system: Systems.Transform,
  mutations: transformServiceMutationPolicies,
})
export class TransformService
  extends SystemBackedServiceBase<TransformSystem>
  implements ITransformService
{
  public static readonly name = Channels.Transform

  constructor(ctx: IContext) {
    super(ctx)
  }

  public async beginTransform(
    _ids: IDType[],
    _label = TransactionLabel.TransformLayer
  ) {}

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

  public async rotate(ids: IDType[], request: RotateRequest) {
    return this.system.rotate(ids, request)
  }

  public async rotate$(ids: IDType[], request: RotateRequest) {
    return this.system.rotate(ids, request)
  }

  public async setSize(ids: IDType[], request: AbsoluteSizeResizeRequest) {
    return this.system.setSize(ids, request)
  }

  public async setSize$(ids: IDType[], request: AbsoluteSizeResizeRequest) {
    return this.system.setSize(ids, request)
  }

  public async resize(ids: IDType[], width: number, height: number) {
    return this.system.resize(ids, width, height)
  }

  public async resize$(ids: IDType[], width: number, height: number) {
    return this.system.resize(ids, width, height)
  }

  public async resizeByHandle(
    ids: IDType[],
    direction: ResizeHandleDirection,
    pointerWorld: vec2
  ) {
    return this.system.resizeByHandle(ids, direction, pointerWorld)
  }

  public async resizeByHandle$(
    ids: IDType[],
    direction: ResizeHandleDirection,
    pointerWorld: vec2
  ) {
    return this.system.resizeByHandle(ids, direction, pointerWorld)
  }
}
