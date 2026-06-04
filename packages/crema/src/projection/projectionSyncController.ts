import {
  Channels,
  type IDisposable,
  type IDType,
  type ILatteFile,
} from '@latte-js/bean'

import type { Editor } from '@latte-js/syrup'

type NodeIdMapPayload = [id: IDType, index: number][]
type DirtyPayload = IDType[] | { ids?: IDType[] }

const toDirtyIds = (payload: DirtyPayload): IDType[] => {
  if (Array.isArray(payload)) {
    return payload
  }
  return payload.ids ?? []
}

export class ProjectionSyncController {
  private _disposables: IDisposable[] = []
  private _started = false
  private _version = 0
  private _dirtyIds: IDType[] = []

  constructor(private readonly _editor: Editor) {}

  public get version() {
    return this._version
  }

  public get dirtyIds() {
    return [...this._dirtyIds]
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
        this.markDirty(toDirtyIds(payload as DirtyPayload))
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

  public markDirty(ids: IDType[]) {
    this._dirtyIds = [...ids]
    this._version++
    this._editor.renderer.requestRender()
  }

  public dispose() {
    for (const disposable of this._disposables.splice(0)) {
      disposable.dispose()
    }
    this._dirtyIds = []
    this._started = false
  }
}
