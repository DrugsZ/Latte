import type { Channels, IServiceMap } from '@latte-js/bean'

import { toService } from '../ipc'
import { ChannelClient } from '../ipc/channelClient'
import { IPCMessagePortProtocol } from '../ipc/protocol/ipcMessageport'
import { Lifecycle } from '../lifecycle/lifecycle'

interface LifecycleResponse {
  type: Lifecycle
  resId: string
  payload?: unknown
  error?: unknown
}

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

    await this._waitForLifecycleResponse(
      requestId,
      Lifecycle.InitSessionSuccess,
      Lifecycle.InitSessionError
    )
    return true
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
    const response = this._waitForLifecycleResponse(
      requestId,
      Lifecycle.InitKernelSuccess,
      Lifecycle.InitKernelError
    )

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

    const { payload } = await response
    this._initIPC(this._messageChannel.port1)
    return payload
  }

  private _waitForLifecycleResponse(
    requestId: string,
    successType: Lifecycle,
    errorType: Lifecycle
  ): Promise<LifecycleResponse> {
    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent<LifecycleResponse>) => {
        const { type, resId, error } = e.data
        if (resId !== requestId) {
          return
        }

        this._worker.removeEventListener('message', handler)
        if (type === successType) {
          resolve(e.data)
          return
        }

        if (type === errorType) {
          reject(new Error(String(error || 'Lifecycle request failed')))
          return
        }

        reject(new Error(`Unexpected lifecycle response: ${String(type)}`))
      }

      this._worker.addEventListener('message', handler)
    })
  }
}
