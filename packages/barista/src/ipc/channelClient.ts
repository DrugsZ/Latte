import {
  DEFAULT_SCENE_GRAPH_NAME,
  JsonRpcMessageType,
  type IServiceMap,
  type JsonRpcId,
  type JsonRpcMessage,
  type JsonRpcError,
} from '@latte-js/bean'

import {
  createJsonRpcListenMessage,
  createJsonRpcNotification,
  createJsonRpcRequest,
  createJsonRpcUnlistenMessage,
  type IChannel,
  type IChannelClient,
  type IDisposable,
} from './ipc'

import type { IMessagePassingProtocol } from './protocol/protocol'

export class ChannelClientError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message)
    this.name = 'ChannelClientError'
  }

  public static fromJsonRpcError(error: JsonRpcError) {
    return new ChannelClientError(error.code, error.message, error.data)
  }
}

export class ChannelClient implements IChannelClient {
  private _pendingRequests = new Map<
    JsonRpcId,
    { resolve: (value: any) => void; reject: (reason?: any) => void }
  >()
  private _listeners = new Map<
    string,
    Map<number, { sessionId: string; listener: (msg: JsonRpcMessage) => void }>
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
    listener: (msg: JsonRpcMessage) => void,
    sessionId?: string | null
  ): IDisposable {
    const id = this._nextId++
    const eventId = `${channelName}.${method}`
    const listenerSessionId = this._normalizeSessionId(sessionId)
    if (!this._listeners.has(eventId)) {
      this._listeners.set(eventId, new Map())
    }
    this._listeners.get(eventId)!.set(id, {
      sessionId: listenerSessionId,
      listener,
    })

    this._protocol.send(
      createJsonRpcListenMessage(eventId, id, undefined, listenerSessionId)
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
        this._protocol.send(createJsonRpcUnlistenMessage(id, listenerSessionId))
      },
    }
  }

  public getChannel<T extends keyof IServiceMap>(
    channelName: T,
    sessionId?: string | null
  ): IChannel
  public getChannel(channelName: string, sessionId?: string | null): IChannel
  public getChannel(channelName: string, sessionId?: string | null) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this
    const hasFixedSession = arguments.length >= 2
    const resolveSessionId = () =>
      hasFixedSession ? sessionId : that._targetSessionId
    const channel = {
      call<T>(method: string, ...args: any[]) {
        const isNotification = method.endsWith('$')
        const callSessionId = resolveSessionId()
        if (isNotification) {
          const id = that._nextId++
          that._protocol.send(
            createJsonRpcNotification(
              `${channelName}.${method}`,
              id,
              args,
              callSessionId || undefined
            )
          )
          return
        }
        return that._request<T>(
          channelName,
          method,
          args,
          callSessionId || undefined
        )
      },
      listen: (method: string, listener: (msg: JsonRpcMessage) => void) =>
        that._addListener(channelName, method, listener, resolveSessionId()),
    }
    return channel
  }

  private _normalizeSessionId(sessionId: string | null | undefined) {
    return sessionId || DEFAULT_SCENE_GRAPH_NAME
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
          reject(ChannelClientError.fromJsonRpcError(msg.error))
        } else {
          resolve(msg.result)
        }
      }
    } else if (msg.type === JsonRpcMessageType.Notification) {
      const eventId = msg.method
      const listeners = this._listeners.get(eventId)
      if (listeners) {
        const messageSessionId = this._normalizeSessionId(msg.sessionId)
        listeners.forEach(entry => {
          if (entry.sessionId === messageSessionId) {
            entry.listener(msg)
          }
        })
      } else if (eventId === 'rpc.onError') {
        console.error('[IPC] Notification error:', msg.params)
      }
    }
  }
}
