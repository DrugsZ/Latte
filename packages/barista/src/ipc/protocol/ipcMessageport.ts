import type { IMessagePassingProtocol } from './protocol'
import type { IDisposable, JsonRpcMessage } from '../ipc'

export class IPCMessagePortProtocol implements IMessagePassingProtocol {
  private _handler: ((e: MessageEvent) => void) | null = null
  constructor(private _port: MessagePort) {}
  send(data: JsonRpcMessage): void {
    this._port.postMessage(data)
  }
  onMessage(listener: (data: JsonRpcMessage) => void): IDisposable {
    this._handler = (e: MessageEvent) => listener(e.data)
    this._port.addEventListener('message', this._handler)

    return {
      dispose: () => this._port.removeEventListener('message', this._handler!),
    }
  }

  dispose() {
    this._port.close()
  }
}
