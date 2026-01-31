import type { Channels } from '@latte-js/bean'
import type { SceneGraph } from '@latte-js/espresso'
import type { IContext } from './types'

export abstract class ServiceBase<T = any> {
  static readonly name: Channels

  constructor(protected readonly context: IContext) {}

  protected get sceneGraph(): SceneGraph {
    return this.context.sceneGraph
  }

  protected get system(): T {
    return this.context.accessSystem.getSystem(
      (this.constructor as ServiceConstructor).name as any
    ) as T
  }
}

export type ServiceConstructor = (new (context: IContext) => ServiceBase) & {
  readonly name: Channels
}

const registeredServices: ServiceConstructor[] = []

export function getRegisteredServices() {
  return registeredServices
}

export function service(constructor: ServiceConstructor) {
  registeredServices.push(constructor)
}

export type { IContext }
