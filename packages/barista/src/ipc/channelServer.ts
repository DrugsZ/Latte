import {
  createJsonRpcErrorResponse,
  createJsonRpcSuccessResponse,
  type IChannelServer,
  type IServerChannel,
} from './ipc'
import {
  type JsonRpcMessage,
  type JsonRpcRequest,
  type JsonRpcNotification,
  JsonRpcMessageType,
} from '@latte-js/bean'
import type { IMessagePassingProtocol } from './protocol/protocol'

export class ChannelServer implements IChannelServer {
  private _channels = new Map<string, IServerChannel>()

  constructor(private _protocol: IMessagePassingProtocol) {
    this._protocol.onMessage(this.handleMessage.bind(this))
  }

  public registerChannel(name: string, channel: IServerChannel) {
    this._channels.set(name, channel)
  }

  public async handleMessage(msg: JsonRpcMessage) {
    if (
      msg.type !== JsonRpcMessageType.Request &&
      msg.type !== JsonRpcMessageType.Notification
    ) {
      return
    }

    const { method, params, id } = msg as JsonRpcRequest | JsonRpcNotification
    const [channelName, methodName] = method.split('.')

    const channel = this._channels.get(channelName)
    if (!channel) {
      console.warn(`[IPC] Unknown channel: ${channelName}`)
      if (id !== null) {
        this._protocol.send(
          createJsonRpcErrorResponse(id, -32601, `Method not found: ${method}`)
        )
      }
      return
    }

    try {
      const result = await channel.call(
        channelName,
        methodName,
        ...(Array.isArray(params)
          ? params
          : params !== undefined
            ? [params]
            : [])
      )

      if (id !== null && msg.type === JsonRpcMessageType.Request) {
        this._protocol.send(createJsonRpcSuccessResponse(id, result))
      }
    } catch (e: any) {
      if (id !== null && msg.type === JsonRpcMessageType.Request) {
        this._protocol.send(
          createJsonRpcErrorResponse(id, -32603, e.message || 'Internal error')
        )
      }
      console.error(`[IPC] Error in ${channelName}.${methodName}:`, e)
    }
  }
}
