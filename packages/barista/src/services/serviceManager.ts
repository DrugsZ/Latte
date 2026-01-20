import { type Channels } from '@latte-js/bean'
import type { SceneGraph } from '@latte-js/espresso'
import type { BaristaSystem } from '../systems/systems'
import type { IContext } from './types'
import { getRegisteredServices, type ServiceBase } from './serviceBase'

export class ServiceManager implements IContext {
  private _services: Map<Channels, ServiceBase> = new Map()

  constructor(
    public readonly sceneGraph: SceneGraph,
    public readonly accessSystem: BaristaSystem
  ) {
    this._initServices()
  }

  private _initServices() {
    const services = getRegisteredServices()
    services.forEach(Ctor => {
      this.register(new Ctor(this))
    })
  }

  public getService<T>(name: Channels): T | undefined {
    return this._services.get(name) as T | undefined
  }

  public forEachService(
    callback: (service: ServiceBase, name: Channels) => void
  ): void {
    this._services.forEach((service, name) => {
      callback(service, name)
    })
  }

  registerService(name: Channels, service: ServiceBase): void {
    this._services.set(name, service)
  }

  register(service: ServiceBase): void {
    this.registerService(service.channelName, service)
  }
}
