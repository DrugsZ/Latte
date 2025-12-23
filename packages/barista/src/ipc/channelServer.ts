import {
  createJsonRpcErrorResponse,
  createJsonRpcSuccessResponse,
  type IChannelServer,
  type IServerChannel,
  type JsonRpcMessage,
  type JsonRpcRequest,
  type JsonRpcNotification,
} from './ipc'
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
    if (!('method' in msg)) {
      return
    }

    const { method, params } = msg as JsonRpcRequest | JsonRpcNotification
    const id = 'id' in msg ? (msg as JsonRpcRequest).id : undefined
    const [channelName, methodName] = method.split('.')

    const channel = this._channels.get(channelName)
    if (!channel) {
      console.warn(`[IPC] Unknown channel: ${channelName}`)
      if (id !== undefined && id !== null) {
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
        Array.isArray(params) ? params : params !== undefined ? [params] : []
      )

      if (id !== undefined && id !== null) {
        this._protocol.send(createJsonRpcSuccessResponse(id, result))
      }
    } catch (e: any) {
      if (id !== undefined && id !== null) {
        this._protocol.send(
          createJsonRpcErrorResponse(id, -32603, e.message || 'Internal error')
        )
      }
      console.error(`[IPC] Error in ${channelName}.${methodName}:`, e)
    }
  }
}
