import { SceneGraph } from '@latte-js/espresso'
import { ChannelServer, fromService } from '../ipc'
import type { IMessagePassingProtocol } from '../ipc/protocol/protocol'
import { ServiceManager } from '../services'
import { BaristaSystem, Systems } from '../systems'
import { createJsonRpcNotification } from '../ipc/ipc'
import { type IDType, Channels } from '@latte-js/bean'

const PIPELINE_SYSTEMS: Systems[] = [Systems.Matrix, Systems.AABB]

export class BaristaEngine {
  private _graphs = new Map<string, SceneGraph>()
  private _activeGraph: SceneGraph | null = null
  private _activeSessionId: string | null = null
  private _proxyGraph: SceneGraph
  private _systems: BaristaSystem
  private _serviceManager: ServiceManager
  private _channelServer: ChannelServer | null = null
  private _isTickScheduled = false

  constructor(
    buffer: SharedArrayBuffer,
    private _protocol: IMessagePassingProtocol,
    allocBuffer: SharedArrayBuffer
  ) {
    this._proxyGraph = this._createGraphProxy()
    this._systems = new BaristaSystem(this._proxyGraph)
    this._serviceManager = new ServiceManager(this._proxyGraph, this._systems)

    this._initChannelServer()
    // Initial kernel session
    const kernelGraph = this.initSession('kernel', buffer, allocBuffer)
    this._activeGraph = kernelGraph
    this._activeSessionId = 'kernel'
  }

  private _createGraphProxy(): SceneGraph {
    return new Proxy({} as SceneGraph, {
      get: (target, prop) => {
        if (!this._activeGraph) {
          throw new Error(
            `[BaristaEngine] No active graph set for property: ${String(prop)}`
          )
        }
        const value = Reflect.get(this._activeGraph, prop)
        if (typeof value === 'function') {
          return value.bind(this._activeGraph)
        }
        return value
      },
      set: (target, prop, value) => {
        if (!this._activeGraph) {
          throw new Error(
            `[BaristaEngine] No active graph set for property: ${String(prop)}`
          )
        }
        return Reflect.set(this._activeGraph, prop, value)
      },
    })
  }

  public initSession(
    sessionId: string,
    buffer: SharedArrayBuffer,
    allocBuffer: SharedArrayBuffer
  ) {
    const graph = new SceneGraph(buffer, allocBuffer)
    this._graphs.set(sessionId, graph)
    return graph
  }

  private _initChannelServer = () => {
    this._channelServer = new ChannelServer(this._protocol)
    this._channelServer.onMessage(this.scheduleTick, this)
    this._channelServer.onBeforeCall(sessionId => {
      const targetId = sessionId || 'kernel'
      this._activeSessionId = targetId
      this._activeGraph = this._graphs.get(targetId) || null
    })

    this._serviceManager.forEachService((service, name) => {
      this._channelServer!.registerChannel(name, fromService(service))
    })
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
    if (this._activeGraph && this._activeSessionId) {
      this._tickCurrentSession(this._activeSessionId)
    }
  }

  private _tickCurrentSession(sessionId: string) {
    const dirtyMap = this._proxyGraph.tracker.flush()

    if (dirtyMap.size === 0) return

    for (const name of PIPELINE_SYSTEMS) {
      const system = this._systems.getSystem(name)
      system?.process?.(dirtyMap)
    }

    this._sendRenderNotification(
      sessionId,
      Array.from(dirtyMap.keys())
        .map(item => this._proxyGraph.getUUID(item))
        .filter((item): item is IDType => !!item)
    )
  }

  private _sendRenderNotification(sessionId: string, dirtyIds: IDType[]) {
    this._protocol.send(
      createJsonRpcNotification(
        'scene.onDirty',
        null,
        { ids: dirtyIds },
        sessionId
      )
    )
  }
}
