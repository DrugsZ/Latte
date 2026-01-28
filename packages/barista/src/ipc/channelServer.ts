import {
  createJsonRpcErrorResponse,
  createJsonRpcSuccessResponse,
  createJsonRpcNotification,
  type IChannelServer,
  type IServerChannel,
  type IDisposable,
} from './ipc'
import {
  type JsonRpcMessage,
  type JsonRpcRequest,
  type JsonRpcNotification,
  type JsonRpcListenMessage,
  type JsonRpcUnlistenMessage,
  JsonRpcMessageType,
  type JsonRpcId,
} from '@latte-js/bean'
import { Emitter } from '@latte-js/kit'
import type { IMessagePassingProtocol } from './protocol/protocol'

export class ChannelServer implements IChannelServer {
  private _channels = new Map<string, IServerChannel>()
  private _activeListeners = new Map<JsonRpcId, IDisposable>()
  private _onMessage = new Emitter<void>()
  public readonly onMessage = this._onMessage.event

  constructor(private _protocol: IMessagePassingProtocol) {
    this._protocol.onMessage(this.handleMessage.bind(this))
  }

  public registerChannel(name: string, channel: IServerChannel) {
    this._channels.set(name, channel)
  }

  private async _runWithOnMessage(fn: () => any): Promise<any> {
    const data = await fn()
    await this._onMessage.fire()
    return data
  }

  public async handleMessage(msg: JsonRpcMessage) {
    this._runWithOnMessage(() => {
      switch (msg.type) {
        case JsonRpcMessageType.Request:
        case JsonRpcMessageType.Notification:
          return this._handleCall(msg)
        case JsonRpcMessageType.Listen:
          return this._handleListen(msg)
        case JsonRpcMessageType.Unlisten:
          return this._handleUnlisten(msg)
      }
    })
  }

  private async _handleCall(msg: JsonRpcRequest | JsonRpcNotification) {
    const { method, params, id } = msg
    const [channelName, methodName] = method.split('.')

    const channel = this._channels.get(channelName)
    if (!channel) {
      console.warn(`[IPC] Unknown channel: ${channelName}`)
      if (id !== null && msg.type === JsonRpcMessageType.Request) {
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

  private _handleListen(msg: JsonRpcListenMessage) {
    const { method, id, params } = msg
    const [channelName, methodName] = method.split('.')

    const channel = this._channels.get(channelName)
    if (channel) {
      const event = channel.listen(channelName, methodName, params)
      if (typeof event === 'function') {
        const disposable = event((data: any) => {
          this._protocol.send(createJsonRpcNotification(method, null, data))
        })
        this._activeListeners.set(id, disposable)
      }
    }
  }

  private _handleUnlisten(msg: JsonRpcUnlistenMessage) {
    const { id } = msg
    const disposable = this._activeListeners.get(id)
    if (disposable) {
      disposable.dispose()
      this._activeListeners.delete(id)
    }
  }
}
