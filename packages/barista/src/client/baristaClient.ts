import type { Channels, IServiceMap } from '@latte-js/bean'

import { toService } from '../ipc'
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

  public getService<T extends Channels>(channelId: T): IServiceMap[T] {
    return toService(
      this._channelClient.getChannel(channelId)
    ) as IServiceMap[T]
  }

  public setTargetSession(sessionId: string | null) {
    this._channelClient.setTargetSession(sessionId)
  }

  public async initSession(
    sessionId: string,
    sharedBuffer: SharedArrayBuffer,
    allocBuffer: SharedArrayBuffer,
    heapBuffer: SharedArrayBuffer
  ) {
    const requestId = Math.random().toString(36).substring(2)
    this._worker.postMessage({
      type: Lifecycle.InitSession,
      sessionId,
      buffer: sharedBuffer,
      allocBuffer,
      heapBuffer,
      requestId,
    })
    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        const { type, resId } = e.data
        if (resId === requestId) {
          this._worker.removeEventListener('message', handler)
          if (type === Lifecycle.InitSessionSuccess) {
            resolve(true)
          } else {
            reject(new Error('Init session failed'))
          }
        }
      }
      this._worker.addEventListener('message', handler)
    })
  }

  private _initIPC(port: MessagePort) {
    this._channelClient = new ChannelClient(new IPCMessagePortProtocol(port))
  }

  public async init(
    sharedBuffer: SharedArrayBuffer,
    allocBuffer: SharedArrayBuffer,
    heapBuffer: SharedArrayBuffer
  ) {
    this._messageChannel = new MessageChannel()
    const requestId = Math.random().toString(36).substring(2)
    this._worker.postMessage(
      {
        type: Lifecycle.InitKernel,
        buffer: sharedBuffer,
        allocBuffer,
        heapBuffer,
        requestId,
      },
      [this._messageChannel.port2]
    )
    return new Promise((resolve, reject) => {
      this._worker.onmessage = (e: MessageEvent) => {
        const { type, payload, resId } = e.data
        if (type === Lifecycle.InitKernelSuccess && resId === requestId) {
          this._initIPC(this._messageChannel.port1)
          resolve(payload)
        } else if (type === Lifecycle.InitKernelError && resId === requestId) {
          reject(new Error(e.data.error || 'Init kernel failed'))
        }
      }
    })
  }
}
