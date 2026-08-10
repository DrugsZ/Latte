import {
  type Channels,
  DEFAULT_SCENE_GRAPH_NAME,
  type ISceneDirtyPayload,
} from '@latte-js/bean'

import { ChannelServer, fromService } from '../ipc'
import { createJsonRpcNotification } from '../ipc/ipc'
import { DirtyBatch } from '../pipeline/dirtyBatch'
import { NotificationPlanner } from '../pipeline/notificationPlanner'
import { PipelineRunner } from '../pipeline/pipelineRunner'
import { ServiceManager } from '../services'
import { BaristaSystem } from '../systems'
import { MutationGate } from '../transactions/mutationPolicy'
import { BaristaSessionManager } from './baristaSessionManager'

import type { IMessagePassingProtocol } from '../ipc/protocol/protocol'
import type { IChannelCallContext, IServerChannel } from '../ipc'

export class BaristaEngine {
  private _sessionManager = new BaristaSessionManager()
  private _systems: BaristaSystem
  private _serviceManager: ServiceManager
  private _mutationGate: MutationGate
  private _pipelineRunner: PipelineRunner
  private _notificationPlanner: NotificationPlanner
  private _channelServer: ChannelServer | null = null
  private _isTickScheduled = false
  private _pendingTickSessions = new Set<string>()

  constructor(
    buffer: SharedArrayBuffer,
    private _protocol: IMessagePassingProtocol,
    allocBuffer: SharedArrayBuffer,
    heapBuffer: SharedArrayBuffer
  ) {
    // init kernel session and systems before starting the channel server to ensure that the engine is ready to handle incoming messages
    this.initSession(DEFAULT_SCENE_GRAPH_NAME, buffer, allocBuffer, heapBuffer)
    this._systems = new BaristaSystem(this._sessionManager)
    this._mutationGate = new MutationGate(this._sessionManager)
    this._pipelineRunner = new PipelineRunner(this._systems)
    this._notificationPlanner = new NotificationPlanner(this._sessionManager)
    this._serviceManager = new ServiceManager(
      this._sessionManager,
      this._systems
    )
    this._initChannelServer()
  }

  public initSession(
    sessionId: string,
    buffer: SharedArrayBuffer,
    allocBuffer: SharedArrayBuffer,
    heapBuffer: SharedArrayBuffer
  ) {
    return this._sessionManager.initSession(
      sessionId,
      buffer,
      allocBuffer,
      heapBuffer
    ).sceneGraph
  }

  private _initChannelServer = () => {
    this._channelServer = new ChannelServer(this._protocol)
    this._channelServer.onMessage(this.scheduleTick, this)
    this._channelServer.onValidateSession(sessionId => {
      this._sessionManager.getSession(sessionId)
    })

    this._serviceManager.forEachService((_service, name) => {
      this._channelServer!.registerChannel(
        name,
        this._createSessionChannel(name)
      )
    })
  }

  private _createSessionChannel(name: Channels): IServerChannel {
    return {
      call: (ctx: IChannelCallContext, command: string, ...args: any[]) => {
        const context = this._sessionManager.getContext(ctx.sessionId)
        return this._sessionManager.runWithContext(context, () => {
          const service = this._serviceManager.getService(name)
          return fromService(service as object, {
            channelName: name,
            mutationGate: this._mutationGate,
          }).call({ sessionId: context.currentSessionId }, command, ...args)
        })
      },
      listen: (ctx: IChannelCallContext, event: string) => {
        const context = this._sessionManager.getContext(ctx.sessionId)
        return (listener: (data: unknown) => void) =>
          this._sessionManager.runWithContext(context, () => {
            const service = this._serviceManager.getService(name)
            const subscribe = fromService(service as object, {
              channelName: name,
              mutationGate: this._mutationGate,
            }).listen({ sessionId: context.currentSessionId }, event)
            return subscribe(listener)
          })
      },
    }
  }

  public scheduleTick(sessionId = DEFAULT_SCENE_GRAPH_NAME) {
    const normalizedSessionId = sessionId || DEFAULT_SCENE_GRAPH_NAME
    this._pendingTickSessions.add(normalizedSessionId)
    if (this._isTickScheduled) return

    this._isTickScheduled = true

    queueMicrotask(() => {
      try {
        this.tick()
      } finally {
        this._isTickScheduled = false
      }
    })
  }

  public tick() {
    const sessionIds = Array.from(this._pendingTickSessions)
    this._pendingTickSessions.clear()

    for (const sessionId of sessionIds) {
      this._tickSession(sessionId)
    }
  }

  private _tickSession(sessionId: string) {
    const session = this._sessionManager.getSession(sessionId)
    const context = this._sessionManager.getContext(sessionId)
    let payload: ISceneDirtyPayload | null = null

    this._sessionManager.runWithContext(context, () => {
      try {
        const batch = DirtyBatch.from(session.sceneGraph.tracker.flush())

        if (!batch.hasChanges) {
          return
        }

        this._pipelineRunner.process(batch)

        payload = this._notificationPlanner.createDirtyPayload(
          batch,
          session.nextProjectionVersion()
        )
      } finally {
        session.sceneGraph.publishRevision()
      }
    })

    if (payload) {
      this._sendDirtyNotification(sessionId, payload)
    }
  }

  private _sendDirtyNotification(
    sessionId: string,
    payload: ISceneDirtyPayload
  ) {
    this._protocol.send(
      createJsonRpcNotification('scene.onDirty', null, payload, sessionId)
    )
  }
}
