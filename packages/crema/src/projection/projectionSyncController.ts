import {
  NodeType,
  type IDisposable,
  type IDType,
  type ILatteFile,
  type INodeService,
  type ISceneDirtyNode,
  type ISceneDirtyPayload,
  type ISceneService,
} from '@latte-js/bean'
import type { SceneGraph } from '@latte-js/espresso'

import type { EditorHost } from '@latte-js/syrup'

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

// FIXME(projection-events): Split projection state sync from render invalidation
// once metadata/outline panels or multi-session projection consumers need
// explicit events instead of this controller directly calling renderer.
export class ProjectionSyncController {
  private _disposables: IDisposable[] = []
  private _started = false
  private _version = 0
  private _dirtyIds: IDType[] = []
  private _allDirtyIds: IDType[] = []
  private _dirtyNodes: ISceneDirtyNode[] = []

  constructor(
    private readonly _host: EditorHost<SceneGraph>,
    private readonly _nodeService: INodeService,
    private readonly _sceneService: ISceneService
  ) {}

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

    this._disposables.push(
      this._nodeService.onCreate(nodes => {
        this.applyCreated(nodes)
      })
    )
    this._disposables.push(
      this._nodeService.onDelete(nodes => {
        this.applyDeleted(nodes)
      })
    )

    this._disposables.push(
      this._sceneService.onDirty(payload => {
        this.markDirty(payload as DirtyPayload)
      })
    )

    this._started = true
  }

  public applyLoadedDocument(data: ILatteFile, idMap: Map<IDType, number>) {
    this._host.graph.resetUUIDMap(idMap)

    const activeRootId = this._findActiveRootId(data)
    if (activeRootId && this._host.renderer) {
      this._host.renderer.setActiveRootId(activeRootId)
      this._host.renderer.fitToContent(activeRootId)
    }

    this._host.renderer?.requestRender()
    this._version++
    return { idMap, activeRootId }
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

    this._dirtyIds = [...normalized.renderIds]
    this._allDirtyIds = [...normalized.allIds]
    this._dirtyNodes = [...normalized.nodes]
    this._version++

    if (normalized.renderIds.length > 0) {
      this._host.renderer?.requestRender()
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

  private _findActiveRootId(data: ILatteFile): IDType | undefined {
    const page = data.elements.find(node => {
      const type = node.type as string | number
      return type === 'CANVAS' || type === NodeType.CANVAS
    })
    if (page) {
      return page.guid
    }

    const document = data.elements.find(node => {
      const type = node.type as string | number
      return type === 'DOCUMENT' || type === NodeType.DOCUMENT
    })
    return document?.guid
  }
}
