import type { JsonRpcMessage } from '@latte-js/bean'
import type { IMessagePassingProtocol } from './protocol'
import type { IDisposable } from '../ipc'

export class WebMessagePassingProtocol implements IMessagePassingProtocol {
  private _handler: ((e: MessageEvent) => void) | null = null
  constructor(private _worker: Worker) {}
  send(data: JsonRpcMessage): void {
    this._worker.postMessage(data)
  }
  onMessage(listener: (data: JsonRpcMessage) => void): IDisposable {
    this._handler = (e: MessageEvent) => listener(e.data)
    this._worker.addEventListener('message', this._handler)

    return {
      dispose: () =>
        this._worker.removeEventListener('message', this._handler!),
    }
  }

  dispose() {
    this._worker.terminate()
  }
}

export class WebWorkerMessagePassingProtocol implements IMessagePassingProtocol {
  private _handler: ((e: MessageEvent) => void) | null = null

  send(msg: JsonRpcMessage): void {
    self.postMessage(msg)
  }

  onMessage(listener: (msg: JsonRpcMessage) => void): IDisposable {
    this._handler = (e: MessageEvent) => listener(e.data)
    self.addEventListener('message', this._handler)

    return {
      dispose: () => self.removeEventListener('message', this._handler!),
    }
  }

  dispose() {
    self.close()
  }
}
