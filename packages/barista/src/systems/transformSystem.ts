import { type SceneGraph, NodeCursor } from '@latte-js/espresso'

const createSnapshot = (cursor: NodeCursor, id: string) => {}

type ISnapshot = Float32Array

export class TransformSystem {
  private _cursor: NodeCursor
  private _snapshots: Map<string, ISnapshot> = new Map()
  constructor(private _scene: SceneGraph) {
    this._cursor = new NodeCursor(this._scene, 0)
  }

  private _createSnapshot(id: string) {
    const index = this._scene.getIndex(id)
    this._cursor.to(index)
    const { x, y, width, height, transform } = this._cursor
    const snapshot = new Float32Array([x, y, width, height, ...transform])
    this._snapshots.set(id, snapshot)
  }

  private _createSnapshots(ids: string[]) {
    ids.forEach(this._createSnapshot)
  }

  public startSession(ids: string[]) {
    this._snapshots.clear()
    this._createSnapshots(ids)
  }

  public endSession() {
    this._snapshots.clear()
  }
}
