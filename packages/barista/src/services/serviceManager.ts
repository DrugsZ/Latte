import { type Channels, type IServiceMap } from '@latte-js/bean'
import type { SceneGraph } from '@latte-js/espresso'
import type { BaristaSystem } from '../systems/systems'
import type { IContext } from './types'
import {
  type ServiceBase,
  getRegisteredServices,
  type ServiceConstructor,
} from './serviceBase'

export class ServiceManager implements IContext {
  private _services = new Map<Channels, ServiceBase>()

  constructor(
    public readonly sceneGraph: SceneGraph,
    public readonly accessSystem: BaristaSystem
  ) {
    this._initServices()
  }

  private _initServices() {
    const services = getRegisteredServices()
    services.forEach(Ctor => {
      const instance = new Ctor(this)
      this._services.set(Ctor.name, instance)
    })
  }

  public getService<T extends Channels>(name: T): IServiceMap[T] {
    return this._services.get(name) as unknown as IServiceMap[T]
  }

  public forEachService(
    callback: (service: ServiceBase, name: Channels) => void
  ): void {
    this._services.forEach((service, name) => {
      callback(service, name)
    })
  }

  public registerService(ctor: ServiceConstructor, service: ServiceBase): void {
    this._services.set(ctor.name, service)
  }
}
