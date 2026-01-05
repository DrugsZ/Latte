import { SceneGraph } from '@latte-js/espresso'
import { ChannelServer, fromService } from '../ipc'
import type { IMessagePassingProtocol } from '../ipc/protocol/protocol'
import { createServices } from '../services'
import { BaristaSystem, TransformSystem } from '../systems'

export class BaristaEngine {
  private _sceneGraph: SceneGraph | null = null
  private _channelServer: ChannelServer | null = null
  private _systems: BaristaSystem | null = new BaristaSystem()

  constructor(
    buffer: SharedArrayBuffer,
    private _protocol: IMessagePassingProtocol
  ) {
    this._initSceneGroup(buffer)
    this._initSystems()
    this._initChannelServer()
  }

  private _initSceneGroup = (buffer: SharedArrayBuffer) => {
    this._sceneGraph = new SceneGraph(buffer)
  }

  private _initChannelServer = () => {
    if (!this._sceneGraph) {
      return
    }
    this._channelServer = new ChannelServer(this._protocol)
    const services = createServices(this._sceneGraph)

    Object.entries(services).forEach(([name, factory]) => {
      const serviceInstance = new factory(this._sceneGraph)
      this._channelServer!.registerChannel(name, fromService(serviceInstance!))
    })
  }

  private _initSystems = () => {
    if (!this._sceneGraph) {
      return
    }
    this._systems!.registerSystem(
      'transform',
      new TransformSystem(this._sceneGraph)
    )
  }
}
