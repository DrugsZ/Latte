import {
  JsonRpcErrorCode,
  JsonRpcMessageType,
  LATTE_RPC_PROTOCOL_VERSION,
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
  type IChannelCallContext,
  type IChannelServer,
  type IDisposable,
  type IServerChannel,
} from './ipc'

import type { IMessagePassingProtocol } from './protocol/protocol'

export class ChannelServer implements IChannelServer {
  private _channels = new Map<string, IServerChannel>()
  private _activeListeners = new Map<JsonRpcId, IDisposable>()
  private _onMessage = new Emitter<string>()
  public readonly onMessage = this._onMessage.event
  private _messageQueue: Promise<void> = Promise.resolve()

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

  private async _runWithOnMessage(
    sessionId: string,
    fn: () => any
  ): Promise<any> {
    const data = await fn()
    await this._onMessage.fire(sessionId)
    return data
  }

  public handleMessage(msg: JsonRpcMessage) {
    this._messageQueue = this._messageQueue.then(
      () => this._handleMessage(msg),
      () => this._handleMessage(msg)
    )
    return this._messageQueue
  }

  private async _handleMessage(msg: JsonRpcMessage) {
    if (!this._validateProtocol(msg)) {
      return
    }

    if ('sessionId' in msg && this._onBeforeCall) {
      try {
        this._onBeforeCall(msg.sessionId || '')
      } catch (error) {
        this._sendError(
          msg,
          JsonRpcErrorCode.InvalidRequest,
          error instanceof Error ? error.message : String(error),
          { sessionId: msg.sessionId }
        )
        return
      }
    }

    const sessionId = 'sessionId' in msg ? msg.sessionId || '' : ''
    await this._runWithOnMessage(sessionId, async () => {
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
    if (!channelName || !methodName) {
      this._sendError(
        msg,
        JsonRpcErrorCode.InvalidRequest,
        `Invalid method: ${method}`,
        { method }
      )
      return
    }

    const channel = this._channels.get(channelName)
    if (!channel) {
      console.warn(`[IPC] Unknown channel: ${channelName}`)
      this._sendError(
        msg,
        JsonRpcErrorCode.MethodNotFound,
        `Method not found: ${method}`,
        { method, channelName }
      )
      return
    }

    const ctx = this._createChannelCallContext(sessionId)

    try {
      const result = await channel.call(
        ctx,
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
            JsonRpcErrorCode.InternalError,
            e.message || 'Internal error',
            { method, channelName, methodName },
            sessionId
          )
        )
      } else {
        this._sendNotificationError(msg, e.message || 'Internal error', {
          method,
          channelName,
          methodName,
        })
      }
      console.error(`[IPC] Error in ${channelName}.${methodName}:`, e)
    }
  }

  private _handleListen(msg: JsonRpcListenMessage) {
    const { method, id, params, sessionId } = msg
    const [channelName, methodName] = method.split('.')
    const ctx = this._createChannelCallContext(sessionId)

    try {
      const channel = this._channels.get(channelName)
      if (!channel) {
        if (this._isEngineNotificationListen(channelName, methodName)) {
          this._activeListeners.set(id, { dispose() {} })
          return
        }
        throw new Error(`Event channel not found: ${channelName}`)
      }
      const event = channel.listen(ctx, methodName, params)
      if (typeof event === 'function') {
        const disposable = event((data: any) => {
          this._protocol.send(
            createJsonRpcNotification(method, null, data, sessionId)
          )
        })
        this._activeListeners.set(id, disposable)
      }
    } catch (error: any) {
      this._sendNotificationError(msg, error.message || 'Listen failed', {
        method,
        channelName,
        methodName,
      })
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

  private _isEngineNotificationListen(channelName: string, methodName: string) {
    return channelName === 'scene' && methodName.startsWith('on')
  }

  private _createChannelCallContext(
    sessionId: string | undefined
  ): IChannelCallContext {
    return {
      sessionId: sessionId || '',
    }
  }

  private _validateProtocol(msg: JsonRpcMessage) {
    if (
      msg.protocolVersion === undefined ||
      msg.protocolVersion === LATTE_RPC_PROTOCOL_VERSION
    ) {
      return true
    }

    this._sendError(
      msg,
      JsonRpcErrorCode.ProtocolVersionMismatch,
      `Unsupported RPC protocol version: ${msg.protocolVersion}`,
      {
        expected: LATTE_RPC_PROTOCOL_VERSION,
        actual: msg.protocolVersion,
      }
    )
    return false
  }

  private _sendError(
    msg: JsonRpcMessage,
    code: JsonRpcErrorCode,
    message: string,
    data?: any
  ) {
    if (msg.type === JsonRpcMessageType.Request && msg.id !== null) {
      this._protocol.send(
        createJsonRpcErrorResponse(msg.id, code, message, data, msg.sessionId)
      )
      return
    }

    this._sendNotificationError(msg, message, {
      code,
      ...data,
    })
  }

  private _sendNotificationError(
    msg: JsonRpcMessage,
    message: string,
    data?: any
  ) {
    this._protocol.send(
      createJsonRpcNotification(
        'rpc.onError',
        null,
        {
          error: {
            code: JsonRpcErrorCode.NotificationError,
            message,
            data,
          },
          source: {
            type: msg.type,
            id: msg.id,
            method: 'method' in msg ? msg.method : undefined,
          },
        },
        msg.sessionId
      )
    )
  }
}
