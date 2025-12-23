import type { INodeService } from '@latte-js/bean'
import { SceneGraph } from '@latte-js/espresso'
import { ChannelClient } from '../ipc/channelClient'
import { IPCMessagePortProtocol } from '../ipc/protocol/ipcMessageport'
import { Lifecycle } from '../lifecycle/lifecycle'

export class BaristaClient {
  private _worker: Worker
  private _channelClient: ChannelClient
  private _messageChannel: MessageChannel

  constructor(worker: Worker) {
    this._worker = worker
  }

  private async _initIPC(port: MessagePort) {
    this._channelClient = new ChannelClient(new IPCMessagePortProtocol(port))
    const nodeService = this._channelClient.getChannel<INodeService>('node')
  }

  public async init(sharedBuffer: SharedArrayBuffer) {
    this._messageChannel = new MessageChannel()
    const requestId = Math.random().toString(36).substring(2)
    this._worker.postMessage(
      {
        type: Lifecycle.INIT_KERNEL,
        payload: { buffer: sharedBuffer },
        requestId,
      },
      [this._messageChannel.port2]
    )
    this._initIPC(this._messageChannel.port1)
    return new Promise((resolve, reject) => {
      this._worker.onmessage = (e: MessageEvent) => {
        const { type, payload, requestId } = e.data
        if (type === Lifecycle.INIT_KERNEL_SUCCESS && requestId === requestId) {
          resolve(payload)
        }
      }
    })
  }
}
