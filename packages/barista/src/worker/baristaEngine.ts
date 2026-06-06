import { type IDType, DEFAULT_SCENE_GRAPH_NAME } from '@latte-js/bean'
import { SceneGraph } from '@latte-js/espresso'

import { ChannelServer, fromService } from '../ipc'
import { createJsonRpcNotification } from '../ipc/ipc'
import { ServiceManager } from '../services'
import { BaristaSystem, Systems } from '../systems'
import { MutationGate } from '../transactions/mutationPolicy'

import type { IMessagePassingProtocol } from '../ipc/protocol/protocol'

const PIPELINE_SYSTEMS: Systems[] = [Systems.Matrix, Systems.AABB]

export class BaristaEngine {
  private _graphs = new Map<string, SceneGraph>()
  private _activeGraph: SceneGraph | null = null
  private _activeSessionId: string | null = null
  private _proxyGraph: SceneGraph
  private _systems: BaristaSystem
  private _serviceManager: ServiceManager
  private _mutationGate: MutationGate
  private _channelServer: ChannelServer | null = null
  private _isTickScheduled = false

  constructor(
    buffer: SharedArrayBuffer,
    private _protocol: IMessagePassingProtocol,
    allocBuffer: SharedArrayBuffer,
    heapBuffer: SharedArrayBuffer
  ) {
    this._initKernelSession(buffer, allocBuffer, heapBuffer)
    this._proxyGraph = this._createGraphProxy()
    this._systems = new BaristaSystem(this._proxyGraph)
    this._mutationGate = new MutationGate(this._proxyGraph)
    this._serviceManager = new ServiceManager(this._proxyGraph, this._systems)

    this._initChannelServer()
  }

  private _initKernelSession(
    buffer: SharedArrayBuffer,
    allocBuffer: SharedArrayBuffer,
    heapBuffer: SharedArrayBuffer
  ) {
    // Initial kernel session
    const kernelGraph = this.initSession(
      DEFAULT_SCENE_GRAPH_NAME,
      buffer,
      allocBuffer,
      heapBuffer
    )
    this._activeGraph = kernelGraph
    this._activeSessionId = DEFAULT_SCENE_GRAPH_NAME
  }

  private _createGraphProxy(): SceneGraph {
    if (!this._activeGraph) {
      throw new Error(
        '[BaristaEngine] Cannot create graph proxy without an active graph'
      )
    }
    return new Proxy({} as SceneGraph, {
      get: (target, prop) => {
        if (!this._activeGraph) {
          throw new Error(
            `[BaristaEngine] No active graph get for property: ${String(prop)}`
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
    allocBuffer: SharedArrayBuffer,
    heapBuffer: SharedArrayBuffer
  ) {
    const graph = new SceneGraph(buffer, allocBuffer, heapBuffer)
    this._graphs.set(sessionId, graph)
    return graph
  }

  private _initChannelServer = () => {
    this._channelServer = new ChannelServer(this._protocol)
    this._channelServer.onMessage(this.scheduleTick, this)
    this._channelServer.onBeforeCall(sessionId => {
      const targetId = sessionId || DEFAULT_SCENE_GRAPH_NAME
      this._activeSessionId = targetId
      this._activeGraph = this._graphs.get(targetId) || null
    })

    this._serviceManager.forEachService((service, name) => {
      this._channelServer!.registerChannel(
        name,
        fromService(service, {
          channelName: name,
          mutationGate: this._mutationGate,
        })
      )
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
