import type { SceneGraph } from '@latte-js/espresso'
import type { MutationPolicyMap } from '../transactions/mutationPolicy'

export enum Systems {
  Transform = 'transform',
  Node = 'node',
  Query = 'query',
  Matrix = 'matrix',
  AABB = 'aabb',
}

export abstract class SystemBase {
  static readonly name: Systems
  static readonly mutationPolicies?: MutationPolicyMap

  constructor(protected _sceneGraph: SceneGraph) {}

  process?(dirtyMap: Map<number, number>): void
}

export type SystemConstructor = (new (sceneGraph: SceneGraph) => SystemBase) & {
  readonly name: Systems
  readonly mutationPolicies?: MutationPolicyMap
}

export interface ISystemRegistrationOptions {
  readonly mutations?: MutationPolicyMap
}

export type AccessSystem = <T extends SystemBase>(name: Systems) => T

const systemRegistry: SystemConstructor[] = []

export function getRegisteredSystems() {
  return systemRegistry
}

function registerSystem(
  ctor: SystemConstructor,
  options?: ISystemRegistrationOptions
) {
  if (options?.mutations) {
    ;(ctor as any).mutationPolicies = options.mutations
  }
  systemRegistry.push(ctor)
}

export function system(ctor: SystemConstructor): void
export function system(
  options: ISystemRegistrationOptions
): (ctor: SystemConstructor) => void
export function system(arg: SystemConstructor | ISystemRegistrationOptions) {
  if (typeof arg === 'function') {
    registerSystem(arg)
    return
  }

  return (ctor: SystemConstructor) => {
    registerSystem(ctor, arg)
  }
}

export class BaristaSystem {
  private _systems = new Map<Systems, SystemBase>()

  constructor(private _sceneGraph: SceneGraph) {
    this._init()
  }

  private _init() {
    systemRegistry.forEach(ctor => {
      const instance = new ctor(this._sceneGraph)
      this._systems.set(ctor.name, instance)
    })
  }

  public registerSystem(ctor: SystemConstructor, system: SystemBase) {
    this._systems.set(ctor.name, system)
  }

  public getSystem<T extends SystemBase>(name: Systems): T {
    return this._systems.get(name) as T
  }
}
