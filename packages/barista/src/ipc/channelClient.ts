import {
  createJsonRpcNotification,
  createJsonRpcRequest,
  createJsonRpcListenMessage,
  createJsonRpcUnlistenMessage,
  type IChannelClient,
  type IChannel,
  type IDisposable,
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
  private _listeners = new Map<
    string,
    Map<number, (msg: JsonRpcMessage) => void>
  >()
  private _nextId = 0
  private _targetSessionId: string | null = null

  constructor(private _protocol: IMessagePassingProtocol) {
    this._protocol.onMessage(this._handleMessage.bind(this))
  }

  public setTargetSession(sessionId: string | null) {
    this._targetSessionId = sessionId
  }

  public send(message: {
    documentId?: string | null
    channel: string
    method: string
    args: any[]
  }): Promise<any> {
    return this._request(
      message.channel,
      message.method,
      message.args,
      message.documentId ?? undefined
    )
  }

  private _request<T>(
    channelName: string,
    method: string,
    args: any[],
    sessionId?: string
  ): Promise<T> {
    const id = this._nextId++
    return new Promise((resolve, reject) => {
      this._pendingRequests.set(id, { resolve, reject })
      this._protocol.send(
        createJsonRpcRequest(
          `${channelName}.${method}`,
          id,
          args,
          sessionId || this._targetSessionId || undefined
        )
      )
    })
  }

  private _addListener(
    channelName: string,
    method: string,
    listener: (msg: JsonRpcMessage) => void
  ): IDisposable {
    const id = this._nextId++
    const eventId = `${channelName}.${method}`
    if (!this._listeners.has(eventId)) {
      this._listeners.set(eventId, new Map())
    }
    this._listeners.get(eventId)!.set(id, listener)

    this._protocol.send(
      createJsonRpcListenMessage(
        eventId,
        id,
        undefined,
        this._targetSessionId || undefined
      )
    )

    return {
      dispose: () => {
        const listeners = this._listeners.get(eventId)
        if (listeners) {
          listeners.delete(id)
          if (listeners.size === 0) {
            this._listeners.delete(eventId)
          }
        }
        this._protocol.send(
          createJsonRpcUnlistenMessage(id, this._targetSessionId || undefined)
        )
      },
    }
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
            createJsonRpcNotification(
              `${channelName}.${method}`,
              id,
              args,
              that._targetSessionId || undefined
            )
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
      const listeners = this._listeners.get(eventId)
      if (listeners) {
        listeners.forEach(listener => listener(msg))
      }
    }
  }
}
