import { DEFAULT_SCENE_GRAPH_NAME, type IDType } from '@latte-js/bean'
import { MutationScopeKind } from '@latte-js/espresso'

import { getHistoryManager, getTransactionManager } from './transactionRegistry'

import {
  toSceneGraphContext,
  type ISceneGraphContext,
  type SceneGraphContextSource,
} from '../context/sceneGraphContext'

type PolicyResolver<T> = T | ((args: readonly unknown[]) => T)

export enum MutationPolicyKind {
  Readonly = 'readonly',
  WriteNoHistory = 'writeNoHistory',
  Manual = 'manual',
  History = 'history',
  Atomic = 'atomic',
  SessionBegin = 'sessionBegin',
  SessionMutation = 'sessionMutation',
  SessionCommit = 'sessionCommit',
  SessionCancel = 'sessionCancel',
}

export interface IReadonlyMutationPolicy {
  readonly kind: MutationPolicyKind.Readonly
}

export interface IWriteNoHistoryMutationPolicy {
  readonly kind: MutationPolicyKind.WriteNoHistory
}

export interface IManualMutationPolicy {
  readonly kind: MutationPolicyKind.Manual
}

export interface IHistoryMutationPolicy {
  readonly kind: MutationPolicyKind.History
}

export interface IAtomicMutationPolicy {
  readonly kind: MutationPolicyKind.Atomic
  readonly label: PolicyResolver<string>
  readonly ids?: PolicyResolver<IDType[]>
}

export interface ISessionBeginMutationPolicy {
  readonly kind: MutationPolicyKind.SessionBegin
  readonly label: PolicyResolver<string>
  readonly ids?: PolicyResolver<IDType[]>
  readonly sessionKey?: string
}

export interface ISessionMutationPolicy {
  readonly kind: MutationPolicyKind.SessionMutation
  readonly sessionKey?: string
}

export interface ISessionCommitMutationPolicy {
  readonly kind: MutationPolicyKind.SessionCommit
  readonly sessionKey?: string
}

export interface ISessionCancelMutationPolicy {
  readonly kind: MutationPolicyKind.SessionCancel
  readonly sessionKey?: string
}

export type MutationPolicy =
  | IReadonlyMutationPolicy
  | IWriteNoHistoryMutationPolicy
  | IManualMutationPolicy
  | IHistoryMutationPolicy
  | IAtomicMutationPolicy
  | ISessionBeginMutationPolicy
  | ISessionMutationPolicy
  | ISessionCommitMutationPolicy
  | ISessionCancelMutationPolicy

export type MutationPolicyFactory = (args: readonly unknown[]) => MutationPolicy

export type MutationPolicyMap = Record<
  string,
  MutationPolicy | MutationPolicyFactory
>

interface IActiveMutationSession {
  readonly sessionId: string
  readonly sessionKey: string
  readonly label: string
}

const resolvePolicyValue = <T>(
  value: PolicyResolver<T> | undefined,
  args: readonly unknown[],
  fallback: T
) => {
  if (typeof value === 'function') {
    return (value as (args: readonly unknown[]) => T)(args)
  }
  return value ?? fallback
}

const normalizeSessionId = (sessionId: string) =>
  sessionId || DEFAULT_SCENE_GRAPH_NAME

export class MutationGate {
  private _activeSessions = new Map<string, IActiveMutationSession>()
  private readonly _context: ISceneGraphContext

  constructor(source: SceneGraphContextSource) {
    this._context = toSceneGraphContext(source)
    this._sceneGraph.setMutationGuardEnabled(true)
  }

  private get _sceneGraph() {
    return this._context.sceneGraph
  }

  public async run<T>(
    sessionId: string,
    serviceName: string,
    command: string,
    policy: MutationPolicy,
    args: readonly unknown[],
    invoke: () => T | Promise<T>
  ): Promise<T> {
    const normalizedSessionId = normalizeSessionId(sessionId)

    switch (policy.kind) {
      case MutationPolicyKind.Readonly:
        return invoke()
      case MutationPolicyKind.WriteNoHistory:
        this._assertNoActiveMutation(normalizedSessionId, command)
        return this._runWithMutationScope(
          MutationScopeKind.WriteNoHistory,
          command,
          serviceName,
          command,
          invoke
        )
      case MutationPolicyKind.Manual:
        this._assertNoActiveMutation(normalizedSessionId, command)
        return this._runWithMutationScope(
          MutationScopeKind.Manual,
          command,
          serviceName,
          command,
          invoke
        )
      case MutationPolicyKind.History:
        this._assertNoActiveMutation(normalizedSessionId, command)
        return this._runWithMutationScope(
          MutationScopeKind.History,
          command,
          serviceName,
          command,
          invoke
        )
      case MutationPolicyKind.Atomic:
        return this._runAtomicMutation(
          normalizedSessionId,
          serviceName,
          command,
          policy,
          args,
          invoke
        )
      case MutationPolicyKind.SessionBegin:
        return this._beginSession(
          normalizedSessionId,
          serviceName,
          command,
          policy,
          args,
          invoke
        )
      case MutationPolicyKind.SessionMutation:
        return this._runActiveSessionMutation(
          normalizedSessionId,
          this._sessionKey(serviceName, policy.sessionKey),
          serviceName,
          command,
          invoke
        )
      case MutationPolicyKind.SessionCommit:
        return this._commitSession(
          normalizedSessionId,
          this._sessionKey(serviceName, policy.sessionKey),
          command,
          invoke
        )
      case MutationPolicyKind.SessionCancel:
        return this._cancelSession(
          normalizedSessionId,
          this._sessionKey(serviceName, policy.sessionKey),
          command,
          invoke
        )
    }
  }

  private async _runAtomicMutation<T>(
    sessionId: string,
    serviceName: string,
    command: string,
    policy: IAtomicMutationPolicy,
    args: readonly unknown[],
    invoke: () => T | Promise<T>
  ): Promise<T> {
    const sessionKey = this._sessionKey(serviceName)
    if (this._activeSessions.has(sessionId)) {
      const active = this._assertActiveSession(sessionId, sessionKey, command)
      return this._runWithMutationScope(
        MutationScopeKind.History,
        active.label,
        serviceName,
        command,
        invoke
      )
    }

    const label = resolvePolicyValue(policy.label, args, command)
    const ids = resolvePolicyValue(policy.ids, args, [])
    return this._runWithMutationScope(
      MutationScopeKind.History,
      label,
      serviceName,
      command,
      () => this._runCommittedTransaction(sessionId, label, ids, invoke)
    )
  }

  private async _beginSession<T>(
    sessionId: string,
    serviceName: string,
    command: string,
    policy: ISessionBeginMutationPolicy,
    args: readonly unknown[],
    invoke: () => T | Promise<T>
  ): Promise<T> {
    if (this._activeSessions.has(sessionId)) {
      const active = this._activeSessions.get(sessionId)!
      throw new Error(
        `[MutationGate] Cannot ${command} while "${active.label}" is active`
      )
    }

    const label = resolvePolicyValue(policy.label, args, command)
    const ids = resolvePolicyValue(policy.ids, args, [])
    const sessionKey = this._sessionKey(serviceName, policy.sessionKey)
    const manager = getTransactionManager(this._sceneGraph, sessionId)

    manager.begin(label, ids)
    this._activeSessions.set(sessionId, { sessionId, sessionKey, label })

    try {
      return await this._runWithMutationScope(
        MutationScopeKind.History,
        label,
        serviceName,
        command,
        invoke
      )
    } catch (error) {
      this._runWithMutationScope(
        MutationScopeKind.History,
        label,
        serviceName,
        command,
        () => manager.abort()
      )
      this._activeSessions.delete(sessionId)
      throw error
    }
  }

  private async _runActiveSessionMutation<T>(
    sessionId: string,
    sessionKey: string,
    serviceName: string,
    command: string,
    invoke: () => T | Promise<T>
  ): Promise<T> {
    const active = this._assertActiveSession(sessionId, sessionKey, command)
    return this._runWithMutationScope(
      MutationScopeKind.History,
      active.label,
      serviceName,
      command,
      invoke
    )
  }

  private async _commitSession<T>(
    sessionId: string,
    sessionKey: string,
    command: string,
    invoke: () => T | Promise<T>
  ): Promise<T> {
    const active = this._assertActiveSession(sessionId, sessionKey, command)
    const manager = getTransactionManager(this._sceneGraph, sessionId)

    try {
      const result = await this._runWithMutationScope(
        MutationScopeKind.History,
        active.label,
        sessionKey,
        command,
        invoke
      )
      getHistoryManager(this._sceneGraph).push(sessionId, manager.commit())
      this._activeSessions.delete(sessionId)
      return result
    } catch (error) {
      this._runWithMutationScope(
        MutationScopeKind.History,
        active.label,
        sessionKey,
        command,
        () => manager.abort()
      )
      this._activeSessions.delete(sessionId)
      throw error
    }
  }

  private async _cancelSession<T>(
    sessionId: string,
    sessionKey: string,
    command: string,
    invoke: () => T | Promise<T>
  ): Promise<T> {
    const active = this._assertActiveSession(sessionId, sessionKey, command)
    const manager = getTransactionManager(this._sceneGraph, sessionId)

    try {
      return await this._runWithMutationScope(
        MutationScopeKind.History,
        active.label,
        sessionKey,
        command,
        invoke
      )
    } finally {
      this._runWithMutationScope(
        MutationScopeKind.History,
        active.label,
        sessionKey,
        command,
        () => manager.abort()
      )
      this._activeSessions.delete(sessionId)
    }
  }

  private _assertNoActiveMutation(sessionId: string, command: string) {
    const active = this._activeSessions.get(sessionId)
    if (!active) {
      return
    }

    throw new Error(
      `[MutationGate] Cannot ${command} while "${active.label}" is active`
    )
  }

  private _assertActiveSession(
    sessionId: string,
    sessionKey: string,
    command: string
  ): IActiveMutationSession {
    const active = this._activeSessions.get(sessionId)
    if (active?.sessionKey === sessionKey) {
      return active
    }

    if (!active) {
      throw new Error(
        `[MutationGate] ${command} requires an active mutation session`
      )
    }

    throw new Error(
      `[MutationGate] Cannot ${command} for ${sessionId} while "${active.label}" is active for ${active.sessionId}`
    )
  }

  private _runWithMutationScope<T>(
    kind: MutationScopeKind,
    label: string,
    serviceName: string,
    command: string,
    invoke: () => T | Promise<T>
  ): T | Promise<T> {
    return this._sceneGraph.runWithMutationScope(
      {
        kind,
        label,
        source: `${serviceName}.${command}`,
      },
      invoke
    )
  }

  private _sessionKey(serviceName: string, sessionKey = 'default') {
    return `${serviceName}:${sessionKey}`
  }

  private async _runCommittedTransaction<T>(
    sessionId: string,
    label: string,
    ids: IDType[],
    invoke: () => T | Promise<T>
  ): Promise<T> {
    const manager = getTransactionManager(this._sceneGraph, sessionId)
    manager.begin(label, ids)
    try {
      const result = await invoke()
      getHistoryManager(this._sceneGraph).push(sessionId, manager.commit())
      return result
    } catch (error) {
      manager.abort()
      throw error
    }
  }
}
