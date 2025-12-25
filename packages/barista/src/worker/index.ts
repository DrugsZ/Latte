import { SceneGraph } from '@latte-js/espresso'
import { ChannelServer } from '../ipc'
import { IPCMessagePortProtocol } from '../ipc/protocol/ipcMessageport'
import { channels } from '../channels'
import { Lifecycle } from '../lifecycle/lifecycle'

let sceneGraph: SceneGraph | null = null
let channelServer: ChannelServer | null = null

const initEngine = (buffer: SharedArrayBuffer) => {
  sceneGraph = new SceneGraph(buffer)
}

const initChannelServer = (port: MessagePort) => {
  channelServer = new ChannelServer(new IPCMessagePortProtocol(port))
  channels.forEach(ctor => {
    channelServer!.registerChannel(ctor.channelName, new ctor())
  })
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, requestId } = e.data

  if (type === Lifecycle.INIT_KERNEL) {
    const { buffer } = payload
    initEngine(buffer)
    initChannelServer(e.ports[0])
    self.postMessage({
      type: Lifecycle.INIT_KERNEL_SUCCESS,
      requestId,
      payload: { status: 'ok' },
    })
  }
}
