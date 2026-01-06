import type { TransformSystem } from './transformSystem'

interface IBaristaSystemMap {
  transform?: TransformSystem
}

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
