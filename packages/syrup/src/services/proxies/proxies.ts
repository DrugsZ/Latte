import { editor } from '../../core/editor'

/**
 * 创建领域服务代理（RPC 延迟绑定）
 * 用于延迟绑定 BaristaClient 中的服务，并确保方法调用时 this 指向正确。
 */
export function createDomainServiceProxy<T extends object>(
  serviceId: string
): T {
  return new Proxy({} as T, {
    get: (_, prop) => {
      if (typeof prop !== 'string') return undefined

      return (editor.baristaClient?.getService(serviceId as any) as any)?.[prop]
    },
  })
}
