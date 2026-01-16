import { SceneGraph } from '@latte-js/espresso'
import { ChannelServer, fromService } from '../ipc'
import type { IMessagePassingProtocol } from '../ipc/protocol/protocol'
import { createServices } from '../services'
import { BaristaSystem, TransformSystem, NodeSystem } from '../systems'

export class BaristaEngine {
  private _sceneGraph: SceneGraph | null = null
  private _channelServer: ChannelServer | null = null
  private _systems: BaristaSystem | null = new BaristaSystem()

  constructor(
    buffer: SharedArrayBuffer,
    private _protocol: IMessagePassingProtocol,
    allocBuffer: SharedArrayBuffer
  ) {
    this._initSceneGroup(buffer, allocBuffer)
    this._initSystems()
    this._initChannelServer()
  }

  private _initSceneGroup = (
    buffer: SharedArrayBuffer,
    allocBuffer?: SharedArrayBuffer
  ) => {
    this._sceneGraph = new SceneGraph(buffer, allocBuffer)
  }

  private _initChannelServer = () => {
    if (!this._sceneGraph) {
      return
    }
    this._channelServer = new ChannelServer(this._protocol)
    const services = createServices(this._sceneGraph)

    Object.entries(services).forEach(([name, factory]) => {
      const serviceInstance = new factory(this._sceneGraph, name => {
        return this._systems!.getSystem(name)
      })
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
    this._systems!.registerSystem('node', new NodeSystem(this._sceneGraph))
  }
}
