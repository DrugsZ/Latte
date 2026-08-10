import {
  Channels,
  type AbsoluteSizeResizeRequest,
  type BeginTransformRequest,
  type BeginTransformResult,
  type IDType,
  type ITransformService,
  type ResizeRequest,
  type ResizeHandleDirection,
  type RotateRequest,
  type UpdateTransformRequest,
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

const idsFromFirstArg = (args: readonly unknown[]) => {
  const first = args[0]
  if (Array.isArray(first)) {
    return first as IDType[]
  }
  if (first && typeof first === 'object' && 'ids' in first) {
    return (first as BeginTransformRequest).ids
  }
  return []
}

const transformServiceMutationPolicies: MutationPolicyMap = {
  beginTransform: {
    kind: MutationPolicyKind.SessionBegin,
    label: args =>
      typeof args[1] === 'string'
        ? args[1]
        : args[0] &&
            typeof args[0] === 'object' &&
            'label' in args[0] &&
            typeof (args[0] as BeginTransformRequest).label === 'string'
          ? (args[0] as BeginTransformRequest).label!
          : TransactionLabel.TransformLayer,
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
  updateTransform$: { kind: MutationPolicyKind.SessionMutation },
  updateTransform: { kind: MutationPolicyKind.SessionMutation },
}

interface ActiveTransformSession extends BeginTransformResult {
  readonly documentSessionId: string
  readonly ids: readonly IDType[]
}

const SESSION_BOUND_COMMANDS = new Set([
  'updateTransform',
  'updateTransform$',
  'commitTransform',
  'cancelTransform',
])

const LEGACY_SESSION_UPDATE_COMMANDS = new Set([
  'moveTo',
  'moveTo$',
  'moveBy',
  'moveBy$',
  'transformAround',
  'transformAround$',
  'rotate',
  'rotate$',
  'setSize',
  'setSize$',
  'resize',
  'resize$',
  'resizeByHandle',
  'resizeByHandle$',
])

@Service({
  system: Systems.Transform,
  mutations: transformServiceMutationPolicies,
})
export class TransformService
  extends SystemBackedServiceBase<TransformSystem>
  implements ITransformService
{
  public static readonly name = Channels.Transform
  private readonly _sessions = new Map<string, ActiveTransformSession>()
  private readonly _activeSessionByDocument = new Map<string, string>()
  private _nextSessionOrdinal = 1

  constructor(ctx: IContext) {
    super(ctx)
  }

  protected override _resolveServiceMutationPolicy(
    command: string,
    args: readonly unknown[]
  ) {
    if (SESSION_BOUND_COMMANDS.has(command)) {
      const sessionId =
        command === 'updateTransform' || command === 'updateTransform$'
          ? (args[0] as UpdateTransformRequest | undefined)?.sessionId
          : typeof args[0] === 'string'
            ? args[0]
            : undefined
      this._resolveSession(sessionId)
    } else if (LEGACY_SESSION_UPDATE_COMMANDS.has(command)) {
      this._validateLegacySessionIds(args[0] as IDType[] | undefined, command)
    }

    return super._resolveServiceMutationPolicy(command, args)
  }

  public async beginTransform(ids: IDType[], label?: string): Promise<void>
  public async beginTransform(
    request: BeginTransformRequest
  ): Promise<BeginTransformResult>
  public async beginTransform(
    requestOrIds: BeginTransformRequest | IDType[],
    _label = TransactionLabel.TransformLayer
  ): Promise<BeginTransformResult | void> {
    const ids = Array.isArray(requestOrIds) ? requestOrIds : requestOrIds.ids
    const box = this.system.resolveInteractionGroupBox(ids)
    const documentSessionId = this.currentSessionId
    const sessionId = `transform:${this._nextSessionOrdinal++}`
    const publicationRevision = this.sceneGraph.publicationRevision
    const result: ActiveTransformSession = {
      sessionId,
      documentSessionId,
      baseRevision:
        (publicationRevision & 1) === 1
          ? publicationRevision - 1
          : publicationRevision,
      ids: box?.ids ?? [...ids],
      groupBox: box
        ? {
            ids: box.ids,
            width: box.width,
            height: box.height,
            matrix: box.matrix,
          }
        : null,
    }
    this._sessions.set(sessionId, result)
    this._activeSessionByDocument.set(documentSessionId, sessionId)

    if (Array.isArray(requestOrIds)) {
      return
    }
    return result
  }

  public async updateTransform(request: UpdateTransformRequest) {
    this._applyTransformUpdate(request)
  }

  public async updateTransform$(request: UpdateTransformRequest) {
    this._applyTransformUpdate(request)
  }

  public async commitTransform(sessionId?: string) {
    this._deleteSession(this._resolveSession(sessionId))
  }

  public async cancelTransform(sessionId?: string) {
    this._deleteSession(this._resolveSession(sessionId))
  }

  public async moveTo(ids: IDType[], delta: vec2) {
    return this.system.moveTo(
      this._resolveLegacySessionIds(ids, 'moveTo'),
      delta
    )
  }

  public async moveTo$(ids: IDType[], delta: vec2) {
    return this.system.moveTo(
      this._resolveLegacySessionIds(ids, 'moveTo$'),
      delta
    )
  }

  public async moveBy(ids: IDType[], delta: vec2) {
    return this.system.moveBy(
      this._resolveLegacySessionIds(ids, 'moveBy'),
      delta
    )
  }

  public async moveBy$(ids: IDType[], delta: vec2) {
    return this.system.moveBy(
      this._resolveLegacySessionIds(ids, 'moveBy$'),
      delta
    )
  }

  public async transformAround(
    ids: IDType[],
    matrixPayload: mat2d,
    pivot: vec2
  ) {
    return this.system.transformAround(
      this._resolveLegacySessionIds(ids, 'transformAround'),
      matrixPayload,
      pivot
    )
  }

  public async transformAround$(
    ids: IDType[],
    matrixPayload: mat2d,
    pivot: vec2
  ) {
    return this.system.transformAround(
      this._resolveLegacySessionIds(ids, 'transformAround$'),
      matrixPayload,
      pivot
    )
  }

  public async rotate(ids: IDType[], request: RotateRequest) {
    return this.system.rotate(
      this._resolveLegacySessionIds(ids, 'rotate'),
      request
    )
  }

  public async rotate$(ids: IDType[], request: RotateRequest) {
    return this.system.rotate(
      this._resolveLegacySessionIds(ids, 'rotate$'),
      request
    )
  }

  public async setSize(ids: IDType[], request: AbsoluteSizeResizeRequest) {
    return this.system.setSize(
      this._resolveLegacySessionIds(ids, 'setSize'),
      request
    )
  }

  public async setSize$(ids: IDType[], request: AbsoluteSizeResizeRequest) {
    return this.system.setSize(
      this._resolveLegacySessionIds(ids, 'setSize$'),
      request
    )
  }

  public async resize(ids: IDType[], request: ResizeRequest): Promise<void>
  public async resize(
    ids: IDType[],
    width: number,
    height: number
  ): Promise<void>
  public async resize(
    ids: IDType[],
    requestOrWidth: ResizeRequest | number,
    height?: number
  ) {
    const targetIds = this._resolveLegacySessionIds(ids, 'resize')
    if (typeof requestOrWidth === 'number') {
      return this.system.resize(targetIds, requestOrWidth, height!)
    }
    return this.system.resize(targetIds, requestOrWidth)
  }

  public async resize$(ids: IDType[], request: ResizeRequest): Promise<void>
  public async resize$(
    ids: IDType[],
    width: number,
    height: number
  ): Promise<void>
  public async resize$(
    ids: IDType[],
    requestOrWidth: ResizeRequest | number,
    height?: number
  ) {
    const targetIds = this._resolveLegacySessionIds(ids, 'resize$')
    if (typeof requestOrWidth === 'number') {
      return this.system.resize(targetIds, requestOrWidth, height!)
    }
    return this.system.resize(targetIds, requestOrWidth)
  }

  public async resizeByHandle(
    ids: IDType[],
    direction: ResizeHandleDirection,
    pointerWorld: vec2
  ) {
    return this.system.resizeByHandle(
      this._resolveLegacySessionIds(ids, 'resizeByHandle'),
      direction,
      pointerWorld
    )
  }

  public async resizeByHandle$(
    ids: IDType[],
    direction: ResizeHandleDirection,
    pointerWorld: vec2
  ) {
    return this.system.resizeByHandle(
      this._resolveLegacySessionIds(ids, 'resizeByHandle$'),
      direction,
      pointerWorld
    )
  }

  private _applyTransformUpdate(request: UpdateTransformRequest) {
    const session = this._resolveSession(request.sessionId)

    const ids = [...session.ids]
    const { operation } = request
    switch (operation.kind) {
      case 'move-by':
        this.system.moveBy(ids, operation.delta)
        return
      case 'move-to':
        this.system.moveTo(ids, operation.position)
        return
      case 'transform-around':
        this.system.transformAround(
          ids,
          operation.matrixPayload,
          operation.pivot
        )
        return
      case 'rotate':
        this.system.rotate(ids, {
          ...operation.request,
          pivot:
            operation.request.mode === 'total-delta' &&
            operation.request.pivot === 'interaction-group-center'
              ? {
                  kind: 'world-point',
                  point: this._sessionGroupCenter(session),
                }
              : operation.request.pivot,
        } as RotateRequest)
        return
      case 'resize':
        this.system.resize(ids, operation.request)
        return
    }
  }

  private _sessionGroupCenter(session: ActiveTransformSession): vec2 {
    if (!session.groupBox) {
      return [0, 0]
    }
    const { matrix, width, height } = session.groupBox
    return [
      matrix[0] * (width / 2) + matrix[2] * (height / 2) + matrix[4],
      matrix[1] * (width / 2) + matrix[3] * (height / 2) + matrix[5],
    ]
  }

  private _resolveLegacySessionIds(ids: IDType[], command: string): IDType[] {
    const sessionId = this._activeSessionByDocument.get(this.currentSessionId)
    const session = sessionId ? this._sessions.get(sessionId) : undefined
    if (!session) {
      return ids
    }

    if (!sameIdSet(ids, session.ids)) {
      throw new Error(
        `[TransformService] ${command} ids do not match active transform session ids`
      )
    }

    return [...session.ids]
  }

  private _validateLegacySessionIds(
    ids: IDType[] | undefined,
    command: string
  ) {
    if (ids) {
      this._resolveLegacySessionIds(ids, command)
    }
  }

  private _resolveSession(sessionId?: string): ActiveTransformSession {
    const activeSessionId = this._activeSessionByDocument.get(
      this.currentSessionId
    )
    const resolvedSessionId = sessionId || activeSessionId
    const session = resolvedSessionId
      ? this._sessions.get(resolvedSessionId)
      : undefined

    if (
      !session ||
      session.documentSessionId !== this.currentSessionId ||
      session.sessionId !== activeSessionId
    ) {
      throw new Error(
        `[TransformService] Unknown transform session: ${resolvedSessionId ?? '<none>'}`
      )
    }

    return session
  }

  private _deleteSession(session: ActiveTransformSession) {
    this._sessions.delete(session.sessionId)
    if (
      this._activeSessionByDocument.get(session.documentSessionId) ===
      session.sessionId
    ) {
      this._activeSessionByDocument.delete(session.documentSessionId)
    }
  }
}

const sameIdSet = (a: readonly IDType[], b: readonly IDType[]) => {
  const aSet = new Set(a)
  const bSet = new Set(b)
  if (aSet.size !== bSet.size) {
    return false
  }
  for (const id of aSet) {
    if (!bSet.has(id)) {
      return false
    }
  }
  return true
}
