import type { TransformSystem } from './transformSystem'
import type { NodeSystem } from './nodeSystem'
import type { QuerySystem } from './querySystem'
import type { SceneGraph } from '@latte-js/espresso'

export interface IBaristaSystemMap {
  transform: TransformSystem
  node: NodeSystem
  query: QuerySystem
}

export type AccessSystem = <K extends keyof IBaristaSystemMap>(
  name: K
) => IBaristaSystemMap[K]

export type SystemConstructor = new (sceneGraph: SceneGraph) => any

const systemRegistry: {
  name: keyof IBaristaSystemMap
  ctor: SystemConstructor
}[] = []

export function system(name: keyof IBaristaSystemMap) {
  return (ctor: SystemConstructor) => {
    systemRegistry.push({ name, ctor })
  }
}

export class BaristaSystem {
  private _systems: Partial<IBaristaSystemMap> = {}

  constructor(private _sceneGraph: SceneGraph) {
    this._init()
  }

  private _init() {
    systemRegistry.forEach(({ name, ctor }) => {
      this.registerSystem(name, new ctor(this._sceneGraph))
    })
  }

  public registerSystem<T extends keyof IBaristaSystemMap>(
    name: T,
    system: IBaristaSystemMap[T]
  ) {
    this._systems[name] = system
  }

  public getSystem<T extends keyof IBaristaSystemMap>(
    name: T
  ): IBaristaSystemMap[T] {
    return this._systems[name]!
  }
}
