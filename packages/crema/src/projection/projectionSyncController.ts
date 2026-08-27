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

export interface IProjectionDirtyEvent extends NormalizedDirtyPayload {
  readonly sessionId: string | null
  readonly version: number
}

export type ProjectionIdMapChangeKind = 'reset' | 'register' | 'unregister'

export interface IProjectionIdMapChangeEvent {
  readonly kind: ProjectionIdMapChangeKind
  readonly sessionId: string | null
  readonly nodes: NodeIdMapPayload
}

export interface IProjectionSyncServices {
  getNodeService(sessionId: string | null): INodeService
  getSceneService(sessionId: string | null): ISceneService
}

const uniqueIds = (ids: readonly IDType[]) => Array.from(new Set(ids))

const normalizeDirtyPayload = (
  payload: DirtyPayload
): NormalizedDirtyPayload => {
  if (Array.isArray(payload)) {
    const ids = uniqueIds(payload)
    return {
      renderIds: ids,
      affectedIds: ids,
      nodes: [],
    }
  }

  const flagsById = new Map<IDType, number>()
  for (const node of payload.nodes ?? []) {
    flagsById.set(node.id, (flagsById.get(node.id) ?? 0) | node.flags)
  }

  const nodes = Array.from(flagsById, ([id, flags]) => ({ id, flags }))
  const renderIds = uniqueIds(payload.renderIds ?? payload.ids ?? [])
  const affectedIds = uniqueIds([
    ...(payload.allIds ?? payload.ids ?? renderIds),
    ...renderIds,
    ...nodes.map(node => node.id),
  ])

  return { renderIds, affectedIds, nodes }
}

export class ProjectionSyncController extends Disposable {
  private readonly _sessionDisposables = this._register(new DisposableStore())
  private readonly _onDidMarkDirty = this._register(
    new Emitter<IProjectionDirtyEvent>()
  )
  public readonly onDidMarkDirty: Event<IProjectionDirtyEvent> =
    this._onDidMarkDirty.event

  private readonly _onDidChangeIdMap = this._register(
    new Emitter<IProjectionIdMapChangeEvent>()
  )
  public readonly onDidChangeIdMap: Event<IProjectionIdMapChangeEvent> =
    this._onDidChangeIdMap.event

  private readonly _sessionVersions = new Map<string | null, number>()
  private _started = false
  private _sessionId: string | null | undefined
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
    return this._sessionVersions.get(this._sessionId ?? null) ?? 0
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
    if (graph === this._host.graph) {
      this._resetDirtyState()
    }
    this._onDidChangeIdMap.fire({
      kind: 'reset',
      sessionId: this._resolveSessionId(graph),
      nodes: Array.from(idMap),
    })
    return { idMap }
  }

  public applyCreated(nodes: NodeIdMapPayload) {
    this._applyCreated(this._sessionId ?? null, this._host.graph, nodes)
  }

  public applyDeleted(nodes: NodeIdMapPayload) {
    this._applyDeleted(this._sessionId ?? null, this._host.graph, nodes)
  }

  public markDirty(payload: DirtyPayload) {
    return this._markDirty(this._sessionId ?? null, payload)
  }

  public dispose() {
    super.dispose()
    this._sessionId = undefined
    this._sessionVersions.clear()
    this._resetDirtyState()
    this._started = false
  }

  private _bindSession(sessionId: string | null) {
    if (this._sessionId === sessionId) {
      return
    }

    this._sessionDisposables.clear()
    this._sessionId = sessionId
    this._resetDirtyState()

    const graph = this._host.graph
    const nodeService = this._services.getNodeService(sessionId)
    const sceneService = this._services.getSceneService(sessionId)

    this._sessionDisposables.add(
      nodeService.onDidCreateNode(event => {
        if (this._isCurrentBinding(sessionId, graph)) {
          this._applyCreated(sessionId, graph, event.nodes)
        }
      })
    )
    this._sessionDisposables.add(
      nodeService.onDidDeleteNode(event => {
        if (this._isCurrentBinding(sessionId, graph)) {
          this._applyDeleted(sessionId, graph, event.nodes)
        }
      })
    )
    this._sessionDisposables.add(
      sceneService.onDirty(payload => {
        if (this._isCurrentBinding(sessionId, graph)) {
          this._markDirty(sessionId, payload as DirtyPayload)
        }
      })
    )
  }

  private _applyCreated(
    sessionId: string | null,
    graph: SceneGraph,
    nodes: NodeIdMapPayload
  ) {
    for (const [id, index] of nodes) {
      graph.registerIdMap(id, index)
    }
    if (nodes.length > 0) {
      this._onDidChangeIdMap.fire({
        kind: 'register',
        sessionId,
        nodes: [...nodes],
      })
    }
  }

  private _applyDeleted(
    sessionId: string | null,
    graph: SceneGraph,
    nodes: NodeIdMapPayload
  ) {
    for (const [id, index] of nodes) {
      graph.unregisterIdMap(id, index)
    }
    if (nodes.length > 0) {
      this._onDidChangeIdMap.fire({
        kind: 'unregister',
        sessionId,
        nodes: [...nodes],
      })
    }
  }

  private _markDirty(sessionId: string | null, payload: DirtyPayload) {
    const currentVersion = this._sessionVersions.get(sessionId) ?? 0
    const payloadVersion = Array.isArray(payload) ? undefined : payload.version
    const version = payloadVersion ?? currentVersion + 1

    if (!Number.isSafeInteger(version) || version <= currentVersion) {
      return false
    }

    const normalized = normalizeDirtyPayload(payload)
    this._sessionVersions.set(sessionId, version)
    this._renderDirtyIds = normalized.renderIds
    this._affectedDirtyIds = normalized.affectedIds
    this._dirtyNodes = normalized.nodes

    this._onDidMarkDirty.fire({
      sessionId,
      version,
      renderIds: this.renderDirtyIds,
      affectedIds: this.affectedDirtyIds,
      nodes: this.dirtyNodes,
    })
    return true
  }

  private _isCurrentBinding(sessionId: string | null, graph: SceneGraph) {
    return this._sessionId === sessionId && this._host.graph === graph
  }

  private _resolveSessionId(graph: SceneGraph) {
    return (
      this._host.documents.find(document => document.graph === graph)?.id ??
      null
    )
  }

  private _resetDirtyState() {
    this._renderDirtyIds = []
    this._affectedDirtyIds = []
    this._dirtyNodes = []
  }
}
