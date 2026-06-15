import { IPCMessagePortProtocol } from '../ipc/protocol/ipcMessageport'
import { Lifecycle } from '../lifecycle/lifecycle'

import { BaristaEngine } from './baristaEngine'

interface baseLifecycleMessage {
  type: Lifecycle
  requestId: string
}

interface InitKernelMessage extends baseLifecycleMessage {
  type: Lifecycle.InitKernel
  buffer: SharedArrayBuffer
  allocBuffer: SharedArrayBuffer
  heapBuffer: SharedArrayBuffer
}

interface InitSessionMessage extends baseLifecycleMessage {
  type: Lifecycle.InitSession
  sessionId: string
  buffer: SharedArrayBuffer
  allocBuffer: SharedArrayBuffer
  heapBuffer: SharedArrayBuffer
}

type WorkerBootstrapMessage = InitKernelMessage | InitSessionMessage

let engine: BaristaEngine | null = null

self.onmessage = (event: MessageEvent<WorkerBootstrapMessage>) => {
  switch (event.data.type) {
    case Lifecycle.InitKernel:
      handleInitKernel(event.data, event.ports[0])
      break
    case Lifecycle.InitSession:
      handleInitSession(event.data)
      break
  }
}

function handleInitKernel(message: InitKernelMessage, port: MessagePort) {
  const { buffer, allocBuffer, heapBuffer, requestId } = message
  runLifecycleRequest(
    requestId,
    Lifecycle.InitKernelSuccess,
    Lifecycle.InitKernelError,
    () => {
      if (!port) {
        throw new Error('Init kernel requires a MessagePort')
      }

      engine = new BaristaEngine(
        buffer,
        new IPCMessagePortProtocol(port),
        allocBuffer,
        heapBuffer
      )
    }
  )
}

function handleInitSession(message: InitSessionMessage) {
  const { sessionId, buffer, allocBuffer, heapBuffer, requestId } = message
  runLifecycleRequest(
    requestId,
    Lifecycle.InitSessionSuccess,
    Lifecycle.InitSessionError,
    () => {
      if (!engine) {
        throw new Error('Engine not initialized')
      }

      engine.initSession(sessionId, buffer, allocBuffer, heapBuffer)
    }
  )
}

function runLifecycleRequest(
  requestId: string,
  successType: Lifecycle,
  errorType: Lifecycle,
  run: () => void
) {
  try {
    run()
    postLifecycleResult(successType, requestId)
  } catch (error) {
    postLifecycleResult(errorType, requestId, error)
  }
}

function postLifecycleResult(
  type: Lifecycle,
  requestId: string,
  error?: unknown
) {
  self.postMessage({
    type,
    resId: requestId,
    ...(error ? { error: getErrorMessage(error) } : {}),
  })
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
