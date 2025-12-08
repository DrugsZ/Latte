/* eslint-disable @typescript-eslint/no-explicit-any */

const DI_TARGET = Symbol('DI_TARGET')
const DI_DEPENDENCIES = Symbol('DI_DEPENDENCIES')

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

const serviceCollection = new Map<string, Function>()

export const createDecorator = (serviceId: string) => {
  if (serviceCollection.has(serviceId)) {
    return serviceCollection.get(serviceId)
  }
  const decorator = (target: Function, key: string, paramIndex: number) => {
    storeServiceDependency(serviceId, target, paramIndex)
  }
  serviceCollection.set(serviceId, decorator)
  return decorator
}
