import type { IChannel, IServerChannel } from '../ipc'
import { type JsonRpcMessage } from '@latte-js/bean'

export function toService(channel: IChannel) {
  return new Proxy(
    {},
    {
      get: (_target, propKey) => {
        if (typeof propKey !== 'string') {
          return undefined
        }

        if (propKey.startsWith('on')) {
          return (listener: (msg: JsonRpcMessage) => void) => {
            return channel.listen(propKey, listener)
          }
        }

        return (...args: any[]) => {
          return channel.call(propKey, ...args)
        }
      },
    }
  )
}

export const fromService = (service: object) => {
  return new (class implements IServerChannel {
    listen(_: unknown, event: string, ...args: any[]) {
      if (event.startsWith('on')) {
        const target = (service as any)[event]
        if (typeof target === 'function') {
          return target.apply(service, args)
        }
      }

      throw new Error(`Event not found: ${event}`)
    }

    call(_: unknown, command: string, ...args: any[]): Promise<any> {
      const target = (service as any)[command]
      if (typeof target === 'function') {
        return target.apply(service, args)
      }

      throw new Error(`Method not found: ${command}`)
    }
  })()
}
