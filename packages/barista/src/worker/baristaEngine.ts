import { SceneGraph } from '@latte-js/espresso'
import { ChannelServer, fromService } from '../ipc'
import type { IMessagePassingProtocol } from '../ipc/protocol/protocol'
import { createServices } from '../services'
import { BaristaSystem, TransformSystem, NodeSystem } from '../systems'
import { createJsonRpcNotification } from 'src/ipc/ipc'
import type { IDType } from '@latte-js/bean'

export class BaristaEngine {
  private _sceneGraph: SceneGraph
  private _channelServer: ChannelServer | null = null
  private _systems: BaristaSystem | null = new BaristaSystem()
  private _isTickScheduled = false

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
    this._channelServer.onMessage(this.scheduleTick)
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

  public scheduleTick() {
    if (this._isTickScheduled) return

    this._isTickScheduled = true

    queueMicrotask(() => {
      this.tick()
      this._isTickScheduled = false
    })
  }

  public tick() {
    const dirtyIds = this._sceneGraph.tracker.flush()

    if (dirtyIds.size > 0) {
      this._sendRenderNotification(
        dirtyIds
          .keys()
          .map(item => this._sceneGraph.getUUID(item))
          .toArray()
          .filter(item => !!item)
      )
    }
  }

  private _sendRenderNotification(dirtyIds: IDType[]) {
    this._protocol.send(
      createJsonRpcNotification('scene.onDirty', null, { ids: dirtyIds })
    )
  }
}
