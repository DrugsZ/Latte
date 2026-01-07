import { type IServiceMap, type ChannelID, Channels } from '@latte-js/bean'
import { ChannelClient } from '../ipc/channelClient'
import { toService } from '../ipc'
import { IPCMessagePortProtocol } from '../ipc/protocol/ipcMessageport'
import { Lifecycle } from '../lifecycle/lifecycle'

export class BaristaClient {
  private _worker: Worker
  private _channelClient: ChannelClient
  private _messageChannel: MessageChannel

  constructor(worker: Worker) {
    this._worker = worker
  }

  public getService<T extends ChannelID>(channelId: T): IServiceMap[T] {
    return toService(
      this._channelClient.getChannel(channelId)
    ) as IServiceMap[T]
  }

  private async _initIPC(port: MessagePort) {
    this._channelClient = new ChannelClient(new IPCMessagePortProtocol(port))
    const nodeService = this.getService(Channels.Node)
    const id = await nodeService?.create('test:1', '1', 0, 0)
    const transformService = this.getService(Channels.Transform)
    await transformService?.moveTo([id!], [100, 100])
  }

  public async init(sharedBuffer: SharedArrayBuffer) {
    this._messageChannel = new MessageChannel()
    const requestId = Math.random().toString(36).substring(2)
    this._worker.postMessage(
      {
        type: Lifecycle.INIT_KERNEL,
        buffer: sharedBuffer,
        requestId,
      },
      [this._messageChannel.port2]
    )
    return new Promise((resolve, reject) => {
      this._worker.onmessage = (e: MessageEvent) => {
        const { type, payload, resId } = e.data
        if (type === Lifecycle.INIT_KERNEL_SUCCESS && resId === requestId) {
          this._initIPC(this._messageChannel.port1)
          resolve(payload)
        }
      }
    })
  }
}
