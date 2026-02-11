import { DI_DEPENDENCIES, IInstantiationService } from './instantiation'

export class ServiceCollection {
  private _services = new Map<any, any>()

  constructor(...entries: [any, any][]) {
    for (const [id, service] of entries) {
      this.set(id, service)
    }
  }

  set<T>(id: any, instanceOrDescriptor: T): T {
    const result = this._services.get(id)
    this._services.set(id, instanceOrDescriptor)
    return result
  }

  get<T>(id: any): T {
    return this._services.get(id)
  }
}

export class InstantiationService implements IInstantiationService {
  _serviceBrand: undefined

  constructor(private _services: ServiceCollection = new ServiceCollection()) {
    this._services.set(IInstantiationService, this)
  }

  createInstance<T>(ctor: any, ...args: any[]): T {
    const deps = (ctor as any)[DI_DEPENDENCIES] || []
    const serviceArgs: any[] = []
    for (const dep of deps) {
      const service = this._services.get(dep.id)
      if (!service) {
        throw new Error(`Service ${dep.id} not found`)
      }
      serviceArgs[dep.index] = service
    }

    // Combine injected services with passed arguments
    // VS Code logic is more complex, but this is a start
    return new ctor(...serviceArgs, ...args)
  }

  invokeFunction<R, TS extends any[] = []>(
    fn: (accessor: any, ...args: TS) => R,
    ...args: TS
  ): R {
    const accessor = {
      get: (id: any) => this._services.get(id),
    }
    return fn(accessor, ...args)
  }
}
