import { BaristaEngine } from './baristaEngine'

import { Lifecycle } from '../lifecycle/lifecycle'
import { IPCMessagePortProtocol } from '../ipc/protocol/ipcMessageport'

let engine: BaristaEngine

self.onmessage = e => {
  if (e.data.type === Lifecycle.InitKernel) {
    try {
      const { buffer, allocBuffer } = e.data
      const port = e.ports[0]

      engine = new BaristaEngine(
        buffer,
        new IPCMessagePortProtocol(port),
        allocBuffer
      )
      self.postMessage({
        type: Lifecycle.InitKernelSuccess,
        resId: e.data.requestId,
      })
    } catch (error) {
      self.postMessage({
        type: Lifecycle.InitKernelError,
        resId: e.data.requestId,
        error: error,
      })
    }
  }
}
