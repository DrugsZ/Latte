import { IPCMessagePortProtocol } from '../ipc/protocol/ipcMessageport'
import { Lifecycle } from '../lifecycle/lifecycle'

import { BaristaEngine } from './baristaEngine'

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
        error: (error as any).message || error,
      })
    }
  } else if (e.data.type === Lifecycle.InitSession) {
    try {
      const { sessionId, buffer, allocBuffer, requestId } = e.data
      if (!engine) {
        throw new Error('Engine not initialized')
      }

      engine.initSession(sessionId, buffer, allocBuffer)

      self.postMessage({
        type: Lifecycle.InitSessionSuccess,
        resId: requestId,
      })
    } catch (error) {
      self.postMessage({
        type: Lifecycle.InitSessionError,
        resId: e.data.requestId,
        error: (error as any).message || error,
      })
    }
  }
}
