import { DEFAULT_SCENE_GRAPH_NAME, type IDType } from '@latte-js/bean'

import { getHistoryManager, getTransactionManager } from './transactionRegistry'

import type { MutationScopeKind, SceneGraph } from '@latte-js/espresso'

type PolicyResolver<T> = T | ((args: readonly unknown[]) => T)

export interface IReadonlyMutationPolicy {
  readonly kind: 'readonly'
}

export interface IWriteNoHistoryMutationPolicy {
  readonly kind: 'writeNoHistory'
}

export interface IManualMutationPolicy {
  readonly kind: 'manual'
}

export interface IHistoryMutationPolicy {
  readonly kind: 'history'
}

export interface IAtomicMutationPolicy {
  readonly kind: 'atomic'
  readonly label: PolicyResolver<string>
  readonly ids?: PolicyResolver<IDType[]>
}

export interface ISessionBeginMutationPolicy {
  readonly kind: 'sessionBegin'
  readonly label: PolicyResolver<string>
  readonly ids?: PolicyResolver<IDType[]>
  readonly sessionKey?: string
}

export interface ISessionMutationPolicy {
  readonly kind: 'sessionMutation'
  readonly sessionKey?: string
}

export interface ISessionCommitMutationPolicy {
  readonly kind: 'sessionCommit'
  readonly sessionKey?: string
}

export interface ISessionCancelMutationPolicy {
  readonly kind: 'sessionCancel'
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
  private _activeSession: IActiveMutationSession | null = null

  constructor(private readonly _sceneGraph: SceneGraph) {
    this._sceneGraph.setMutationGuardEnabled(true)
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
      case 'readonly':
        return invoke()
      case 'writeNoHistory':
        this._assertNoActiveMutation(command)
        return this._runWithMutationScope(
          'writeNoHistory',
          command,
          serviceName,
          command,
          invoke
        )
      case 'manual':
        this._assertNoActiveMutation(command)
        return this._runWithMutationScope(
          'manual',
          command,
          serviceName,
          command,
          invoke
        )
      case 'history':
        this._assertNoActiveMutation(command)
        return this._runWithMutationScope(
          'history',
          command,
          serviceName,
          command,
          invoke
        )
      case 'atomic':
        return this._runAtomicMutation(
          normalizedSessionId,
          serviceName,
          command,
          policy,
          args,
          invoke
        )
      case 'sessionBegin':
        return this._beginSession(
          normalizedSessionId,
          serviceName,
          command,
          policy,
          args,
          invoke
        )
      case 'sessionMutation':
        return this._runActiveSessionMutation(
          normalizedSessionId,
          this._sessionKey(serviceName, policy.sessionKey),
          serviceName,
          command,
          invoke
        )
      case 'sessionCommit':
        return this._commitSession(
          normalizedSessionId,
          this._sessionKey(serviceName, policy.sessionKey),
          command,
          invoke
        )
      case 'sessionCancel':
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
    if (this._activeSession) {
      const active = this._assertActiveSession(sessionId, sessionKey, command)
      return this._runWithMutationScope(
        'history',
        active.label,
        serviceName,
        command,
        invoke
      )
    }

    const label = resolvePolicyValue(policy.label, args, command)
    const ids = resolvePolicyValue(policy.ids, args, [])
    return this._runWithMutationScope(
      'history',
      label,
      serviceName,
      command,
      () => this._runCommittedTransaction(label, ids, invoke)
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
    if (this._activeSession) {
      throw new Error(
        `[MutationGate] Cannot ${command} while "${this._activeSession.label}" is active`
      )
    }

    const label = resolvePolicyValue(policy.label, args, command)
    const ids = resolvePolicyValue(policy.ids, args, [])
    const sessionKey = this._sessionKey(serviceName, policy.sessionKey)
    const manager = getTransactionManager(this._sceneGraph)

    manager.begin(label, ids)
    this._activeSession = { sessionId, sessionKey, label }

    try {
      return await this._runWithMutationScope(
        'history',
        label,
        serviceName,
        command,
        invoke
      )
    } catch (error) {
      this._runWithMutationScope('history', label, serviceName, command, () =>
        manager.abort()
      )
      this._activeSession = null
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
      'history',
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
    const manager = getTransactionManager(this._sceneGraph)

    try {
      const result = await this._runWithMutationScope(
        'history',
        active.label,
        sessionKey,
        command,
        invoke
      )
      getHistoryManager(this._sceneGraph).push(manager.commit())
      this._activeSession = null
      return result
    } catch (error) {
      this._runWithMutationScope(
        'history',
        active.label,
        sessionKey,
        command,
        () => manager.abort()
      )
      this._activeSession = null
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
    const manager = getTransactionManager(this._sceneGraph)

    try {
      return await this._runWithMutationScope(
        'history',
        active.label,
        sessionKey,
        command,
        invoke
      )
    } finally {
      this._runWithMutationScope(
        'history',
        active.label,
        sessionKey,
        command,
        () => manager.abort()
      )
      this._activeSession = null
    }
  }

  private _assertNoActiveMutation(command: string) {
    if (!this._activeSession) {
      return
    }

    throw new Error(
      `[MutationGate] Cannot ${command} while "${this._activeSession.label}" is active`
    )
  }

  private _assertActiveSession(
    sessionId: string,
    sessionKey: string,
    command: string
  ): IActiveMutationSession {
    if (
      this._activeSession?.sessionId === sessionId &&
      this._activeSession.sessionKey === sessionKey
    ) {
      return this._activeSession
    }

    if (!this._activeSession) {
      throw new Error(
        `[MutationGate] ${command} requires an active mutation session`
      )
    }

    throw new Error(
      `[MutationGate] Cannot ${command} for ${sessionId} while "${this._activeSession.label}" is active for ${this._activeSession.sessionId}`
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
    label: string,
    ids: IDType[],
    invoke: () => T | Promise<T>
  ): Promise<T> {
    const manager = getTransactionManager(this._sceneGraph)
    manager.begin(label, ids)
    try {
      const result = await invoke()
      getHistoryManager(this._sceneGraph).push(manager.commit())
      return result
    } catch (error) {
      manager.abort()
      throw error
    }
  }
}
