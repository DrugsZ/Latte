import { JsonRpcMessageType, type JsonRpcMessage } from '@latte-js/bean'

import type { IChannel, IChannelCallContext, IServerChannel } from '../ipc'
import {
  MutationPolicyKind,
  type MutationGate,
} from '../transactions/mutationPolicy'

interface IFromServiceOptions {
  readonly channelName?: string
  readonly mutationGate?: MutationGate
}

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

export const fromService = (
  service: object,
  options: IFromServiceOptions = {}
) => {
  return new (class implements IServerChannel {
    listen(_ctx: IChannelCallContext, event: string) {
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

    call(
      ctx: IChannelCallContext,
      command: string,
      ...args: any[]
    ): Promise<any> {
      const target = (service as any)[command]
      if (typeof target === 'function') {
        const invoke = () => target.apply(service, args)
        if (!options.mutationGate) {
          return invoke()
        }

        const policy =
          typeof (service as any).getMutationPolicy === 'function'
            ? (service as any).getMutationPolicy(command, args)
            : { kind: MutationPolicyKind.Readonly }

        return options.mutationGate.run(
          ctx.sessionId,
          options.channelName ?? 'unknown',
          command,
          policy,
          args,
          invoke
        )
      }

      throw new Error(`Method not found: ${command}`)
    }
  })()
}
