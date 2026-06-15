import { type Channels } from '@latte-js/bean'
import type { SceneGraph } from '@latte-js/espresso'

import type {
  MutationPolicy,
  MutationPolicyMap,
} from '../transactions/mutationPolicy'
import type { SystemBase, Systems } from '../systems/systems'
import type { IContext } from './types'

export interface IServiceRegistrationOptions {
  readonly mutations?: MutationPolicyMap
  readonly system?: Systems
}

type SystemConstructorMetadata = Function & {
  mutationPolicies?: MutationPolicyMap
}

const getSystemMutationPolicies = (
  system: SystemBase
): MutationPolicyMap | undefined =>
  (system.constructor as SystemConstructorMetadata).mutationPolicies

export abstract class ServiceBase {
  static readonly name: Channels
  static mutationPolicies?: MutationPolicyMap

  constructor(protected readonly context: IContext) {}

  public getMutationPolicy(
    command: string,
    args: readonly unknown[]
  ): MutationPolicy {
    const policy = this._resolveServiceMutationPolicy(command, args)
    if (policy) {
      return policy
    }

    return this._throwMissingMutationPolicy(command)
  }

  protected get sceneGraph(): SceneGraph {
    return this.context.sceneGraph
  }

  protected get mutationAuthority() {
    return this.context.mutationAuthority
  }

  protected get currentSessionId(): string {
    return this.context.currentSessionId
  }

  protected _resolveServiceMutationPolicy(
    command: string,
    args: readonly unknown[]
  ): MutationPolicy | undefined {
    return this._resolveMutationPolicy(
      this._getServiceConstructor().mutationPolicies,
      command,
      args
    )
  }

  protected _resolveMutationPolicy(
    policies: MutationPolicyMap | undefined,
    command: string,
    args: readonly unknown[]
  ): MutationPolicy | undefined {
    const policy = policies?.[command]
    if (!policy) {
      return undefined
    }
    if (typeof policy === 'function') {
      return policy(args)
    }
    return policy
  }

  protected _throwMissingMutationPolicy(command: string): never {
    throw new Error(
      `[ServiceBase] Missing mutation policy for ${this._getServiceConstructor().name}.${command}`
    )
  }

  protected _getServiceConstructor(): ServiceConstructor {
    const constructor = this.constructor as Partial<ServiceConstructor>
    if (!constructor.name) {
      throw new Error('[ServiceBase] Service constructor is missing name')
    }
    return constructor as ServiceConstructor
  }
}

export abstract class SystemBackedServiceBase<
  T extends SystemBase,
> extends ServiceBase {
  static systemName?: Systems

  public override getMutationPolicy(
    command: string,
    args: readonly unknown[]
  ): MutationPolicy {
    const servicePolicy = this._resolveServiceMutationPolicy(command, args)
    if (servicePolicy) {
      return servicePolicy
    }

    const systemPolicy = this._resolveMutationPolicy(
      this._getSystemMutationPolicies(),
      command,
      args
    )
    if (systemPolicy) {
      return systemPolicy
    }

    return this._throwMissingMutationPolicy(command)
  }

  protected get system(): T {
    const { systemName, name } = this._getSystemBackedServiceConstructor()
    if (!systemName) {
      throw new Error(`[ServiceBase] Missing system binding for ${name}`)
    }
    return this.context.accessSystem.getSystem(systemName) as T
  }

  private _getSystemMutationPolicies(): MutationPolicyMap | undefined {
    return getSystemMutationPolicies(this.system)
  }

  private _getSystemBackedServiceConstructor(): SystemBackedServiceConstructor {
    return this._getServiceConstructor() as SystemBackedServiceConstructor
  }
}

export type ServiceConstructor = (new (context: IContext) => ServiceBase) & {
  readonly name: Channels
  mutationPolicies?: MutationPolicyMap
  systemName?: Systems
}

export type SystemBackedServiceConstructor = ServiceConstructor & {
  systemName?: Systems
}

const registeredServices = new Map<Channels, ServiceConstructor>()

export function getRegisteredServices(): readonly ServiceConstructor[] {
  return Array.from(registeredServices.values())
}

function registerService(
  constructor: ServiceConstructor,
  options?: IServiceRegistrationOptions
) {
  if (options?.mutations) {
    constructor.mutationPolicies = options.mutations
  }
  if (options?.system) {
    constructor.systemName = options.system
  }

  const existing = registeredServices.get(constructor.name)
  if (existing && existing !== constructor) {
    throw new Error(`[ServiceBase] Duplicate service: ${constructor.name}`)
  }
  registeredServices.set(constructor.name, constructor)
}

export function Service(constructor: ServiceConstructor): void
export function Service(
  options: IServiceRegistrationOptions
): (constructor: ServiceConstructor) => void
export function Service(arg: ServiceConstructor | IServiceRegistrationOptions) {
  if (typeof arg === 'function') {
    registerService(arg)
    return
  }

  return (constructor: ServiceConstructor) => {
    registerService(constructor, arg)
  }
}

export type { IContext }
