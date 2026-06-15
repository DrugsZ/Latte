export const DI_TARGET = Symbol('DI_TARGET')
export const DI_DEPENDENCIES = Symbol('DI_DEPENDENCIES')

const storeServiceDependency = (
  id: string,
  target: Function,
  index: number
) => {
  if ((target as any)[DI_TARGET] === target) {
    ;(target as any)[DI_DEPENDENCIES].push({ id, index })
  } else {
    ;(target as any)[DI_TARGET] = target
    ;(target as any)[DI_DEPENDENCIES] = [{ id, index }]
  }
}

const serviceCollection = new Map<string, any>()

export interface ServiceIdentifier<T> {
  (...args: any[]): void
  type: T
}

export const createDecorator = <T>(serviceId: string): ServiceIdentifier<T> => {
  if (serviceCollection.has(serviceId)) {
    return serviceCollection.get(serviceId)
  }
  const decorator = ((target: Function, _key: string, paramIndex: number) => {
    storeServiceDependency(serviceId, target, paramIndex)
  }) as ServiceIdentifier<T>
  decorator.toString = () => serviceId
  serviceCollection.set(serviceId, decorator)
  return decorator
}

const _registry: [ServiceIdentifier<any>, any][] = []

export function registerSingleton<T>(
  id: ServiceIdentifier<T>,
  ctor: any
): void {
  _registry.push([id, ctor])
}

export function getSingletonServiceDescriptors(): [
  ServiceIdentifier<any>,
  any,
][] {
  return _registry
}

export type BrandedService = { _serviceBrand: undefined }

export interface IInstantiationService {
  readonly _serviceBrand: undefined
  createInstance<T>(ctor: any, ...args: any[]): T
  invokeFunction<R, TS extends any[] = []>(
    fn: (accessor: ServicesAccessor, ...args: TS) => R,
    ...args: TS
  ): R
}

export interface ServicesAccessor {
  get<T>(id: Function): T
}

export const IInstantiationService = createDecorator('instantiationService')
