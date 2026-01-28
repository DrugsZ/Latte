import type { SceneGraph } from '@latte-js/espresso'

export enum Systems {
  Transform = 'transform',
  Node = 'node',
  Query = 'query',
  Matrix = 'matrix',
  AABB = 'aabb',
}

export abstract class SystemBase {
  static readonly name: Systems

  constructor(protected _sceneGraph: SceneGraph) {}

  process?(dirtyMap: Map<number, number>): void
}

export type SystemConstructor = (new (sceneGraph: SceneGraph) => SystemBase) & {
  readonly name: Systems
}

export type AccessSystem = <T extends SystemBase>(name: Systems) => T

const systemRegistry: SystemConstructor[] = []

export function system(ctor: SystemConstructor) {
  systemRegistry.push(ctor)
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
