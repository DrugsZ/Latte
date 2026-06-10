import { DEFAULT_SCENE_GRAPH_NAME, type Channels } from '@latte-js/bean'
import type { SceneGraph } from '@latte-js/espresso'
import type {
  MutationPolicy,
  MutationPolicyMap,
} from '../transactions/mutationPolicy'
import { MutationPolicyKind } from '../transactions/mutationPolicy'
import type { IContext } from './types'

const readonlyMutationPolicy: MutationPolicy = {
  kind: MutationPolicyKind.Readonly,
}

export interface IServiceRegistrationOptions {
  readonly mutations?: MutationPolicyMap
}

export abstract class ServiceBase<T = any> {
  static readonly name: Channels
  static readonly mutationPolicies?: MutationPolicyMap

  constructor(protected readonly context: IContext) {}

  public getMutationPolicy(
    command: string,
    args: readonly unknown[]
  ): MutationPolicy {
    const policy =
      this._resolveMutationPolicy(
        (this.constructor as ServiceConstructor).mutationPolicies,
        command,
        args
      ) ??
      this._resolveMutationPolicy(
        this._getSystemMutationPolicies() as MutationPolicyMap | undefined,
        command,
        args
      )
    if (!policy) {
      return readonlyMutationPolicy
    }
    return policy
  }

  protected get sceneGraph(): SceneGraph {
    return this.context.sceneGraph
  }

  protected get currentSessionId(): string {
    return this.context.currentSessionId || DEFAULT_SCENE_GRAPH_NAME
  }

  protected get system(): T {
    return this.context.accessSystem.getSystem(
      (this.constructor as ServiceConstructor).name as any
    ) as T
  }

  private _getSystemMutationPolicies(): MutationPolicyMap | undefined {
    const system = this.context.accessSystem.getSystem(
      (this.constructor as ServiceConstructor).name as any
    ) as any
    return system?.constructor?.mutationPolicies
  }

  private _resolveMutationPolicy(
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
}

export type ServiceConstructor = (new (context: IContext) => ServiceBase) & {
  readonly name: Channels
  readonly mutationPolicies?: MutationPolicyMap
}

const registeredServices: ServiceConstructor[] = []

export interface IMutationPolicyCoverageIssue {
  readonly serviceName: string
  readonly methodName: string
}

export interface IMutationPolicyCoverageOptions {
  readonly fallbackPoliciesByService?: ReadonlyMap<string, MutationPolicyMap>
  readonly ignoredMethods?: readonly string[]
}

export function getRegisteredServices() {
  return registeredServices
}

export function collectMutationPolicyCoverageIssues(
  options: IMutationPolicyCoverageOptions = {}
): IMutationPolicyCoverageIssue[] {
  const issues: IMutationPolicyCoverageIssue[] = []
  const ignored = new Set(options.ignoredMethods ?? [])

  for (const constructor of registeredServices) {
    const servicePolicies = constructor.mutationPolicies ?? {}
    const fallbackPolicies =
      options.fallbackPoliciesByService?.get(constructor.name) ?? {}

    for (const methodName of getServiceCallMethodNames(constructor)) {
      if (
        ignored.has(methodName) ||
        servicePolicies[methodName] ||
        fallbackPolicies[methodName]
      ) {
        continue
      }

      issues.push({
        serviceName: constructor.name,
        methodName,
      })
    }
  }

  return issues
}

export function getServiceCallMethodNames(
  constructor: ServiceConstructor
): string[] {
  return Object.getOwnPropertyNames(constructor.prototype).filter(name => {
    if (name === 'constructor' || name.startsWith('on')) {
      return false
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      constructor.prototype,
      name
    )
    return typeof descriptor?.value === 'function'
  })
}

function registerService(
  constructor: ServiceConstructor,
  options?: IServiceRegistrationOptions
) {
  if (options?.mutations) {
    ;(constructor as any).mutationPolicies = options.mutations
  }
  registeredServices.push(constructor)
}

export function service(constructor: ServiceConstructor): void
export function service(
  options: IServiceRegistrationOptions
): (constructor: ServiceConstructor) => void
export function service(arg: ServiceConstructor | IServiceRegistrationOptions) {
  if (typeof arg === 'function') {
    registerService(arg)
    return
  }

  return (constructor: ServiceConstructor) => {
    registerService(constructor, arg)
  }
}

export type { IContext }
