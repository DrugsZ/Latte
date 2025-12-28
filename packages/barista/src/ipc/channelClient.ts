import {
  createJsonRpcNotification,
  createJsonRpcRequest,
  type IChannelClient,
  type IChannel,
} from './ipc'
import {
  type JsonRpcId,
  type JsonRpcMessage,
  JsonRpcMessageType,
  type IServiceMap,
} from '@latte-js/bean'
import type { IMessagePassingProtocol } from './protocol/protocol'

export class ChannelClient implements IChannelClient {
  private _pendingRequests = new Map<
    JsonRpcId,
    { resolve: (value: any) => void; reject: (reason?: any) => void }
  >()
  private _listeners = new Map<string, (msg: JsonRpcMessage) => void>()
  private _nextId = 0

  constructor(private _protocol: IMessagePassingProtocol) {
    this._protocol.onMessage(this._handleMessage.bind(this))
  }

  private _request<T>(
    channelName: string,
    method: string,
    args: any[]
  ): Promise<T> {
    const id = this._nextId++
    return new Promise((resolve, reject) => {
      this._pendingRequests.set(id, { resolve, reject })
      this._protocol.send(
        createJsonRpcRequest(`${channelName}.${method}`, id, args)
      )
    })
  }

  private _addListener(
    channelName: string,
    method: string,
    listener: (msg: JsonRpcMessage) => void
  ) {
    const eventId = `${channelName}.${method}`
    this._listeners.set(eventId, listener)
  }

  public getChannel<T extends keyof IServiceMap>(channelName: T): IChannel
  public getChannel(channelName: string): IChannel
  public getChannel(channelName: string) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this
    const channel = {
      call<T>(method: string, ...args: any[]) {
        const isNotification = method.endsWith('$')
        if (isNotification) {
          const id = that._nextId++
          that._protocol.send(
            createJsonRpcNotification(`${channelName}.${method}`, id, args)
          )
          return
        }
        return that._request<T>(channelName, method, args)
      },
      listen: (method: string, listener: (msg: JsonRpcMessage) => void) =>
        that._addListener(channelName, method, listener),
    }
    return channel
  }

  private _handleMessage(msg: JsonRpcMessage) {
    if (
      msg.type === JsonRpcMessageType.ResponseSuccess ||
      msg.type === JsonRpcMessageType.ResponseError
    ) {
      if (msg.id !== null && this._pendingRequests.has(msg.id)) {
        const { resolve, reject } = this._pendingRequests.get(msg.id)!
        this._pendingRequests.delete(msg.id)

        if (msg.type === JsonRpcMessageType.ResponseError) {
          reject(new Error(msg.error.message))
        } else {
          resolve(msg.result)
        }
      }
    } else if (msg.type === JsonRpcMessageType.Notification) {
      const eventId = msg.method
      const listener = this._listeners.get(eventId)
      listener?.(msg)
    }
  }
}
