import { DEFAULT_SCENE_GRAPH_NAME } from '@latte-js/bean'
import { SceneGraph } from '@latte-js/espresso'

import { BaristaSession } from './baristaSession'

import type {
  ISceneGraphContext,
  ISceneGraphContextScope,
} from '../context/sceneGraphContext'

export class BaristaSessionManager implements ISceneGraphContextScope {
  private _sessions = new Map<string, BaristaSession>()
  private _contextStack: ISceneGraphContext[] = []

  public initSession(
    sessionId: string,
    buffer: SharedArrayBuffer,
    allocBuffer: SharedArrayBuffer,
    heapBuffer: SharedArrayBuffer
  ) {
    if (this._sessions.has(sessionId)) {
      throw new Error(`[BaristaEngine] Session already exists: ${sessionId}`)
    }

    const sceneGraph = new SceneGraph(buffer, allocBuffer, heapBuffer)
    sceneGraph.setMutationGuardEnabled(true)

    const session = new BaristaSession(sessionId, sceneGraph)
    this._sessions.set(sessionId, session)
    return session
  }

  public getSession(sessionId = DEFAULT_SCENE_GRAPH_NAME) {
    const normalizedSessionId = sessionId || DEFAULT_SCENE_GRAPH_NAME
    const session = this._sessions.get(normalizedSessionId)
    if (!session) {
      throw new Error(`[BaristaEngine] Unknown session: ${normalizedSessionId}`)
    }
    return session
  }

  public getContext(sessionId = DEFAULT_SCENE_GRAPH_NAME): ISceneGraphContext {
    const session = this.getSession(sessionId)
    return {
      currentSessionId: session.id,
      sceneGraph: session.sceneGraph,
    }
  }

  public runWithContext<T>(
    context: ISceneGraphContext,
    invoke: () => T | Promise<T>
  ): T | Promise<T> {
    this._contextStack.push(context)

    const popContext = () => {
      const active = this._contextStack[this._contextStack.length - 1]
      if (active !== context) {
        throw new Error('[BaristaSessionManager] Execution context mismatch')
      }
      this._contextStack.pop()
    }

    try {
      const result = invoke()
      if (result && typeof (result as Promise<T>).finally === 'function') {
        return (result as Promise<T>).finally(popContext)
      }
      popContext()
      return result
    } catch (error) {
      popContext()
      throw error
    }
  }

  private get _currentContext() {
    return (
      this._contextStack[this._contextStack.length - 1] ??
      this.getContext(DEFAULT_SCENE_GRAPH_NAME)
    )
  }

  public get currentSessionId() {
    return this._currentContext.currentSessionId
  }

  public get sceneGraph() {
    return this._currentContext.sceneGraph
  }
}
