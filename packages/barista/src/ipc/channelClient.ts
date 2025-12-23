import {
  createJsonRpcNotification,
  createJsonRpcRequest,
  type IChannelClient,
  type JsonRpcId,
  type JsonRpcMessage,
  type JsonRpcResponse,
  type RemoteChannel,
} from './ipc'
import type { IMessagePassingProtocol } from './protocol/protocol'

export class ChannelClient implements IChannelClient {
  private _pendingRequests = new Map<
    JsonRpcId,
    { resolve: (value: any) => void; reject: (reason?: any) => void }
  >()
  private _nextId = 0

  constructor(private _protocol: IMessagePassingProtocol) {
    this._protocol.onMessage(this._handleMessage.bind(this))
  }

  public getChannel<T extends object>(channelName: string): RemoteChannel<T> {
    return new Proxy(
      {},
      {
        get: (_target, propKey) => {
          const methodName = String(propKey)
          const method = `${channelName}.${methodName}`

          return (...args: any[]) => {
            const isNotification = methodName.endsWith('$')

            if (isNotification) {
              this._protocol.send(createJsonRpcNotification(method, args))
              return
            }

            const id = this._nextId++
            return new Promise((resolve, reject) => {
              this._pendingRequests.set(id, { resolve, reject })
              this._protocol.send(createJsonRpcRequest(method, id, args))
            })
          }
        },
      }
    ) as RemoteChannel<T>
  }

  private _handleMessage(msg: JsonRpcMessage) {
    if ('id' in msg && msg.id !== null && this._pendingRequests.has(msg.id)) {
      const response = msg as JsonRpcResponse
      const { resolve, reject } = this._pendingRequests.get(msg.id)!
      this._pendingRequests.delete(msg.id)

      if ('error' in response) {
        reject(new Error(response.error.message))
      } else {
        resolve(response.result)
      }
    }
  }
}
