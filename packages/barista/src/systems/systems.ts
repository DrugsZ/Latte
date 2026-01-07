import type { TransformSystem } from './transformSystem'
import type { NodeSystem } from './nodeSystem'

export interface IBaristaSystemMap {
  transform?: TransformSystem
  node?: NodeSystem
}

export type AccessSystem = <K extends keyof IBaristaSystemMap>(
  name: K
) => IBaristaSystemMap[K]

export class BaristaSystem {
  private _systems: IBaristaSystemMap = {}

  public registerSystem<T extends keyof IBaristaSystemMap>(
    name: T,
    system: IBaristaSystemMap[T]
  ) {
    this._systems[name] = system
  }

  public getSystem<T extends keyof IBaristaSystemMap>(
    name: T
  ): IBaristaSystemMap[T] {
    return this._systems[name]
  }
}
