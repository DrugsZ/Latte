import { BaristaEngine } from './baristaEngine'

import { Lifecycle } from '../lifecycle/lifecycle'
import { IPCMessagePortProtocol } from '../ipc/protocol/ipcMessageport'

let engine: BaristaEngine

self.onmessage = e => {
  if (e.data.type === Lifecycle.INIT_KERNEL) {
    try {
      const { buffer } = e.data
      const port = e.ports[0]

      engine = new BaristaEngine(buffer, new IPCMessagePortProtocol(port))
      self.postMessage({
        type: Lifecycle.INIT_KERNEL_SUCCESS,
        resId: e.data.requestId,
      })
    } catch (error) {
      self.postMessage({
        type: Lifecycle.INIT_KERNEL_ERROR,
        resId: e.data.requestId,
        error: error,
      })
    }
  }
}
