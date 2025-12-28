import { type JsonRpcMessage } from '@latte-js/bean'
import type { IDisposable } from '../ipc'
import type { IMessagePassingProtocol } from './protocol'

export class IPCMessagePortProtocol implements IMessagePassingProtocol {
  private _handler: ((e: MessageEvent) => void) | null = null
  constructor(private _port: MessagePort) {}
  send(data: JsonRpcMessage): void {
    this._port.postMessage(data)
  }
  onMessage(listener: (data: JsonRpcMessage) => void): IDisposable {
    this._handler = (e: MessageEvent) => listener(e.data)
    this._port.onmessage = e => {
      console.log(e)
      this._handler!(e)
    }

    return {
      dispose: () => (this._port.onmessage = null),
    }
  }

  dispose() {
    this._port.close()
  }
}
