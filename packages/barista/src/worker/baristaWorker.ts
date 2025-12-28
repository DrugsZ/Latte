import { SceneGraph } from '@latte-js/espresso'
import { ChannelServer, fromService } from '../ipc'
import { IPCMessagePortProtocol } from '../ipc/protocol/ipcMessageport'
import { createServices } from '../services'
import { Lifecycle } from '../lifecycle/lifecycle'

// let sceneGraph: SceneGraph | null = null
// let channelServer: ChannelServer | null = null

// const initEngine = (buffer: SharedArrayBuffer) => {
//   sceneGraph = new SceneGraph(buffer)

//   return sceneGraph
// }

// const initChannelServer = (port: MessagePort) => {
//   if (!sceneGraph) {
//     return
//   }
//   channelServer = new ChannelServer(new IPCMessagePortProtocol(port))
//   const services = createServices(sceneGraph)

//   Object.entries(services).forEach(([name, factory]) => {
//     const serviceInstance = new factory(sceneGraph)
//     channelServer!.registerChannel(name, fromService(serviceInstance!))
//   })

//   return channelServer
// }

const startListening = (fn: (e: MessageEvent) => void) => {
  self.onmessage = async (e: MessageEvent) => {
    fn(e)
  }
}
class BaristaWorker {
  private _sceneGraph: SceneGraph | null = null
  private _channelServer: ChannelServer | null = null

  constructor() {
    startListening(this._handleMessage.bind(this))
  }
  private _handleMessage(e: MessageEvent) {
    const { type, payload, requestId } = e.data
    console.log(123444)
    if (type === Lifecycle.INIT_KERNEL) {
      const { buffer } = payload
      this._initEngine(buffer)
      this._initChannelServer(e.ports[0])
      self.postMessage({
        type: Lifecycle.INIT_KERNEL_SUCCESS,
        requestId,
        payload: { status: 'ok' },
      })
    }
  }

  private _initEngine = (buffer: SharedArrayBuffer) => {
    this._sceneGraph = new SceneGraph(buffer)
  }

  private _initChannelServer = (port: MessagePort) => {
    if (!this._sceneGraph) {
      return
    }
    this._channelServer = new ChannelServer(new IPCMessagePortProtocol(port))
    const services = createServices(this._sceneGraph)

    Object.entries(services).forEach(([name, factory]) => {
      const serviceInstance = new factory(this._sceneGraph)
      this._channelServer!.registerChannel(name, fromService(serviceInstance!))
    })
  }
}

new BaristaWorker()

export default BaristaWorker
