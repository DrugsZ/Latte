import type { IDisposable } from '../ipc'
import type { JsonRpcMessage} from '@latte-js/bean'

export interface IMessagePassingProtocol extends IDisposable {
  send(data: JsonRpcMessage): void
  onMessage(listener: (data: JsonRpcMessage) => void): IDisposable
}
