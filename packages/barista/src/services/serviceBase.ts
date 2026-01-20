import type { Channels } from '@latte-js/bean'
import type { SceneGraph } from '@latte-js/espresso'
import type { IContext } from './types'

export abstract class ServiceBase<T = any> {
  abstract readonly channelName: Channels

  constructor(protected readonly context: IContext) {}

  protected get sceneGraph(): SceneGraph {
    return this.context.sceneGraph
  }

  protected get system(): T {
    return this.context.accessSystem.getSystem(this.channelName as any) as T
  }
}

const registeredServices: Array<new (context: IContext) => ServiceBase> = []

export function getRegisteredServices() {
  return registeredServices
}

export function service() {
  return function <T extends new (context: IContext) => ServiceBase>(
    constructor: T
  ) {
    registeredServices.push(constructor)
    return constructor
  }
}

export type { IContext }
