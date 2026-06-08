import {
  Channels,
  type IDisposable,
  type IDType,
  type ILatteFile,
  type ISceneDirtyNode,
  type ISceneDirtyPayload,
} from '@latte-js/bean'

import type { Editor } from '@latte-js/syrup'

type NodeIdMapPayload = [id: IDType, index: number][]
type DirtyPayload = IDType[] | Partial<ISceneDirtyPayload>

interface NormalizedDirtyPayload {
  renderIds: IDType[]
  allIds: IDType[]
  nodes: ISceneDirtyNode[]
}

const normalizeDirtyPayload = (
  payload: DirtyPayload
): NormalizedDirtyPayload => {
  if (Array.isArray(payload)) {
    return {
      renderIds: payload,
      allIds: payload,
      nodes: [],
    }
  }

  const renderIds = payload.renderIds ?? payload.ids ?? []

  return {
    renderIds,
    allIds: payload.allIds ?? payload.ids ?? renderIds,
    nodes: payload.nodes ?? [],
  }
}

export class ProjectionSyncController {
  private _disposables: IDisposable[] = []
  private _started = false
  private _version = 0
  private _dirtyIds: IDType[] = []
  private _allDirtyIds: IDType[] = []
  private _dirtyNodes: ISceneDirtyNode[] = []

  constructor(private readonly _editor: Editor) {}

  public get version() {
    return this._version
  }

  public get dirtyIds() {
    return [...this._dirtyIds]
  }

  public get allDirtyIds() {
    return [...this._allDirtyIds]
  }

  public get dirtyNodes() {
    return [...this._dirtyNodes]
  }

  public start() {
    if (this._started) {
      return
    }

    const nodeService = this._editor.baristaClient.getService(Channels.Node)
    this._disposables.push(
      nodeService.onCreate(nodes => {
        this.applyCreated(nodes)
      })
    )
    this._disposables.push(
      nodeService.onDelete(nodes => {
        this.applyDeleted(nodes)
      })
    )

    const sceneService = this._editor.baristaClient.getService(Channels.Scene)
    this._disposables.push(
      sceneService.onDirty(payload => {
        this.markDirty(payload as DirtyPayload)
      })
    )

    this._started = true
  }

  public hydrateDocument(data: ILatteFile, idMap: Map<IDType, number>) {
    const result = this._editor.hydrateDocument(data, idMap)
    this._version++
    return result
  }

  public applyCreated(nodes: NodeIdMapPayload) {
    for (const [id, index] of nodes) {
      this._editor.graph.registerIdMap(id, index)
    }
    if (nodes.length > 0) {
      this._version++
    }
  }

  public applyDeleted(nodes: NodeIdMapPayload) {
    for (const [id, index] of nodes) {
      this._editor.graph.unregisterIdMap(id, index)
    }
    if (nodes.length > 0) {
      this._version++
    }
  }

  public markDirty(payload: DirtyPayload) {
    const normalized = normalizeDirtyPayload(payload)

    this._dirtyIds = [...normalized.renderIds]
    this._allDirtyIds = [...normalized.allIds]
    this._dirtyNodes = [...normalized.nodes]
    this._version++

    if (normalized.renderIds.length > 0) {
      this._editor.renderer.requestRender()
    }
  }

  public dispose() {
    for (const disposable of this._disposables.splice(0)) {
      disposable.dispose()
    }
    this._dirtyIds = []
    this._allDirtyIds = []
    this._dirtyNodes = []
    this._started = false
  }
}
