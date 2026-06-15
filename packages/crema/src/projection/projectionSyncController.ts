import {
  type IDType,
  type INodeService,
  type ISceneDirtyNode,
  type ISceneDirtyPayload,
  type ISceneService,
} from '@latte-js/bean'
import type { SceneGraph } from '@latte-js/espresso'
import { Disposable, DisposableStore, Emitter, type Event } from '@latte-js/kit'

import type { EditorHost } from '@latte-js/syrup'

type NodeIdMapPayload = [id: IDType, index: number][]
type DirtyPayload = IDType[] | Partial<ISceneDirtyPayload>

interface NormalizedDirtyPayload {
  renderIds: IDType[]
  affectedIds: IDType[]
  nodes: ISceneDirtyNode[]
}

export interface IProjectionDirtyEvent {
  readonly renderIds: IDType[]
  readonly affectedIds: IDType[]
  readonly nodes: ISceneDirtyNode[]
}

export interface IProjectionSyncServices {
  getNodeService(sessionId: string | null): INodeService
  getSceneService(sessionId: string | null): ISceneService
}

const normalizeDirtyPayload = (
  payload: DirtyPayload
): NormalizedDirtyPayload => {
  if (Array.isArray(payload)) {
    return {
      renderIds: payload,
      affectedIds: payload,
      nodes: [],
    }
  }

  const renderIds = payload.renderIds ?? payload.ids ?? []

  return {
    renderIds,
    affectedIds: payload.allIds ?? payload.ids ?? renderIds,
    nodes: payload.nodes ?? [],
  }
}

// FIXME(projection-events): Promote projection dirty events to a broader
// projection event model once outline, selection, or inspector consumers need
// targeted updates beyond render invalidation.
export class ProjectionSyncController extends Disposable {
  private readonly _sessionDisposables = this._register(new DisposableStore())
  private readonly _onDidMarkDirty = this._register(
    new Emitter<IProjectionDirtyEvent>()
  )
  public readonly onDidMarkDirty: Event<IProjectionDirtyEvent> =
    this._onDidMarkDirty.event

  private _started = false
  private _sessionId: string | null | undefined
  private _version = 0
  private _renderDirtyIds: IDType[] = []
  private _affectedDirtyIds: IDType[] = []
  private _dirtyNodes: ISceneDirtyNode[] = []

  constructor(
    private readonly _host: EditorHost<SceneGraph>,
    private readonly _services: IProjectionSyncServices
  ) {
    super()
  }

  public get version() {
    return this._version
  }

  public get renderDirtyIds() {
    return [...this._renderDirtyIds]
  }

  public get affectedDirtyIds() {
    return [...this._affectedDirtyIds]
  }

  public get dirtyNodes() {
    return [...this._dirtyNodes]
  }

  public start() {
    if (this._started) {
      return
    }

    this._register(
      this._host.onDidChangeActiveDocument(doc => {
        this._bindSession(doc?.id ?? null)
      })
    )
    this._bindSession(this._host.activeDocument?.id ?? null)

    this._started = true
  }

  public applyLoadedDocument(idMap: Map<IDType, number>, graph: SceneGraph) {
    graph.resetUUIDMap(idMap)
    this._version++
    return { idMap }
  }

  public applyCreated(nodes: NodeIdMapPayload) {
    for (const [id, index] of nodes) {
      this._host.graph.registerIdMap(id, index)
    }
    if (nodes.length > 0) {
      this._version++
    }
  }

  public applyDeleted(nodes: NodeIdMapPayload) {
    for (const [id, index] of nodes) {
      this._host.graph.unregisterIdMap(id, index)
    }
    if (nodes.length > 0) {
      this._version++
    }
  }

  public markDirty(payload: DirtyPayload) {
    const normalized = normalizeDirtyPayload(payload)

    this._renderDirtyIds = [...normalized.renderIds]
    this._affectedDirtyIds = [...normalized.affectedIds]
    this._dirtyNodes = [...normalized.nodes]
    this._version++

    this._onDidMarkDirty.fire({
      renderIds: this.renderDirtyIds,
      affectedIds: this.affectedDirtyIds,
      nodes: this.dirtyNodes,
    })
  }

  public dispose() {
    super.dispose()
    this._sessionId = undefined
    this._renderDirtyIds = []
    this._affectedDirtyIds = []
    this._dirtyNodes = []
    this._started = false
  }

  private _bindSession(sessionId: string | null) {
    if (this._sessionId === sessionId) {
      return
    }

    this._sessionDisposables.clear()
    this._sessionId = sessionId

    const nodeService = this._services.getNodeService(sessionId)
    const sceneService = this._services.getSceneService(sessionId)

    this._sessionDisposables.add(
      nodeService.onDidCreateNode(event => {
        this.applyCreated(event.nodes)
      })
    )
    this._sessionDisposables.add(
      nodeService.onDidDeleteNode(event => {
        this.applyDeleted(event.nodes)
      })
    )
    this._sessionDisposables.add(
      sceneService.onDirty(payload => {
        this.markDirty(payload as DirtyPayload)
      })
    )
  }
}
