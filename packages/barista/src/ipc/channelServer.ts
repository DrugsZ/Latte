import {
  JsonRpcMessageType,
  type JsonRpcId,
  type JsonRpcListenMessage,
  type JsonRpcMessage,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type JsonRpcUnlistenMessage,
} from '@latte-js/bean'
import { Emitter } from '@latte-js/kit'

import {
  createJsonRpcErrorResponse,
  createJsonRpcNotification,
  createJsonRpcSuccessResponse,
  type IChannelServer,
  type IDisposable,
  type IServerChannel,
} from './ipc'

import type { IMessagePassingProtocol } from './protocol/protocol'

export class ChannelServer implements IChannelServer {
  private _channels = new Map<string, IServerChannel>()
  private _activeListeners = new Map<JsonRpcId, IDisposable>()
  private _onMessage = new Emitter<void>()
  public readonly onMessage = this._onMessage.event

  protected _onBeforeCall: ((sessionId: string) => void) | null = null

  constructor(private _protocol: IMessagePassingProtocol) {
    this._protocol.onMessage(this.handleMessage.bind(this))
  }

  public onBeforeCall(callback: (sessionId: string) => void) {
    this._onBeforeCall = callback
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
    if ('sessionId' in msg) {
      this._onBeforeCall?.(msg.sessionId || '')
    }

    await this._runWithOnMessage(async () => {
      switch (msg.type) {
        case JsonRpcMessageType.Request:
        case JsonRpcMessageType.Notification:
          return await this._handleCall(msg)
        case JsonRpcMessageType.Listen:
          return await this._handleListen(msg)
        case JsonRpcMessageType.Unlisten:
          return await this._handleUnlisten(msg)
      }
    })
  }

  private async _handleCall(msg: JsonRpcRequest | JsonRpcNotification) {
    const { method, params, id, sessionId } = msg
    const [channelName, methodName] = method.split('.')

    const channel = this._channels.get(channelName)
    if (!channel) {
      console.warn(`[IPC] Unknown channel: ${channelName}`)
      if (id !== null && msg.type === JsonRpcMessageType.Request) {
        this._protocol.send(
          createJsonRpcErrorResponse(
            id,
            -32601,
            `Method not found: ${method}`,
            undefined,
            sessionId
          )
        )
      }
      return
    }

    try {
      const result = await channel.call(
        sessionId || '',
        methodName,
        ...(Array.isArray(params)
          ? params
          : params !== undefined
            ? [params]
            : [])
      )

      if (id !== null && msg.type === JsonRpcMessageType.Request) {
        this._protocol.send(createJsonRpcSuccessResponse(id, result, sessionId))
      }
    } catch (e: any) {
      if (id !== null && msg.type === JsonRpcMessageType.Request) {
        this._protocol.send(
          createJsonRpcErrorResponse(
            id,
            -32603,
            e.message || 'Internal error',
            undefined,
            sessionId
          )
        )
      }
      console.error(`[IPC] Error in ${channelName}.${methodName}:`, e)
    }
  }

  private _handleListen(msg: JsonRpcListenMessage) {
    const { method, id, params, sessionId } = msg
    const [channelName, methodName] = method.split('.')

    const channel = this._channels.get(channelName)
    if (channel) {
      const event = channel.listen(sessionId || '', methodName, params)
      if (typeof event === 'function') {
        const disposable = event((data: any) => {
          this._protocol.send(
            createJsonRpcNotification(method, null, data, sessionId)
          )
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
