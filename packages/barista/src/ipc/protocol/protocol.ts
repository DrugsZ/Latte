import type { IDisposable, JsonRpcMessage } from '../ipc'

export interface IMessagePassingProtocol extends IDisposable {
  send(data: JsonRpcMessage): void
  onMessage(listener: (data: JsonRpcMessage) => void): IDisposable
}
