import type { IChannel, IServerChannel } from '../ipc'
import { JsonRpcMessageType, type JsonRpcMessage } from '@latte-js/bean'

export function toService(channel: IChannel) {
  return new Proxy(
    {},
    {
      get: (_target, propKey) => {
        if (typeof propKey !== 'string') {
          return undefined
        }

        if (propKey.startsWith('on')) {
          return (listener: (data: any) => void) => {
            return channel.listen(propKey, (msg: JsonRpcMessage) => {
              if (msg.type === JsonRpcMessageType.Notification) {
                listener(msg.params)
              }
            })
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
    listen(_sessionId: string, event: string) {
      if (event.startsWith('on')) {
        const target = (service as any)[event]
        if (typeof target === 'function') {
          return (listener: (data: any) => void) => {
            return target.call(service, listener)
          }
        }
      }

      throw new Error(`Event not found: ${event}`)
    }

    call(_sessionId: string, command: string, ...args: any[]): Promise<any> {
      const target = (service as any)[command]
      if (typeof target === 'function') {
        return target.apply(service, args)
      }

      throw new Error(`Method not found: ${command}`)
    }
  })()
}
