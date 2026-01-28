import type { IDType } from '@latte-js/bean'
import {
  type SceneGraph,
  NodeCursor,
  applyStretchToMatrix,
  DIRTY_TRANSFORM,
  DIRTY_AABB,
  NULL_INDEX,
} from '@latte-js/espresso'
import { mat2d, vec2 } from 'gl-matrix'
import { system, Systems, SystemBase } from './systems'

type ISnapshot = Float32Array

@system
export class TransformSystem extends SystemBase {
  public static readonly name = Systems.Transform
  private _cursor: NodeCursor
  private _snapshots: Map<IDType, ISnapshot> = new Map()

  constructor(sceneGraph: SceneGraph) {
    super(sceneGraph)
    this._cursor = new NodeCursor(this._sceneGraph, 0)
  }

  private _createSnapshot(index: number) {
    this._cursor.to(index)
    const { x, y, width, height, transform, id } = this._cursor
    if (id === null) return
    const snapshot = new Float32Array([x, y, width, height, ...transform])
    this._snapshots.set(id, snapshot)
  }

  private _createSnapshots(ids: IDType[]) {
    this._snapshots.clear()
    ids.forEach(id => {
      const index = this._sceneGraph.getIndex(id)
      this._createSnapshot(index)
    })
  }

  public startSession(ids: IDType[]) {
    this._snapshots.clear()
    this._createSnapshots(ids)
  }

  public endSession() {
    this._snapshots.clear()
  }

  private _moveTo(id: IDType, delta: vec2) {
    const index = this._sceneGraph.getIndex(id)
    this._cursor.to(index)
    this._cursor.x = delta[0]
    this._cursor.y = delta[1]
    this._sceneGraph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)
  }

  public moveTo(ids: IDType[], delta: vec2) {
    ids.forEach(i => this._moveTo(i, delta))
  }

  private _moveBy(id: IDType, point: vec2) {
    const snapData = this._snapshots.get(id)
    const index = this._sceneGraph.getIndex(id)
    this._cursor.to(index)
    const base = snapData
      ? [snapData[7], snapData[8]]
      : [this._cursor.x, this._cursor.y]
    vec2.add(base, base, point)
    this._cursor.x = base[0]
    this._cursor.y = base[1]
    this._sceneGraph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)
  }

  public moveBy(ids: IDType[], point: vec2) {
    ids.forEach(i => this._moveBy(i, point))
  }

  private _transformAround(id: IDType, matrixPayload: mat2d, pivot: vec2) {
    const index = this._sceneGraph.getIndex(id)
    this._cursor.to(index)
    const localMat = this._cursor.transform

    const transformStep = mat2d.create()
    mat2d.translate(transformStep, transformStep, pivot)
    mat2d.multiply(transformStep, transformStep, matrixPayload)
    mat2d.translate(transformStep, transformStep, [-pivot[0], -pivot[1]])

    mat2d.multiply(localMat, transformStep, localMat)
    this._cursor.transform = localMat

    this._sceneGraph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)
  }

  public transformAround(ids: IDType[], matrixPayload: mat2d, pivot: vec2) {
    ids.forEach(i => this._transformAround(i, matrixPayload, pivot))
  }

  private _resize(id: IDType, width: number, height: number) {
    const index = this._sceneGraph.getIndex(id)
    const snapData = this._snapshots.get(id)
    this._resizeByIndex(index, width, height, snapData)
  }

  private _resizeByIndex(
    index: number,
    width: number,
    height: number,
    snapData?: ISnapshot
  ) {
    this._cursor.to(index)

    const oldWidth = snapData ? snapData[2] : this._cursor.width
    const oldHeight = snapData ? snapData[3] : this._cursor.height

    if (oldWidth === 0 || oldHeight === 0) {
      this._cursor.width = width
      this._cursor.height = height
      this._sceneGraph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)
    }

    const scaleX = width / oldWidth
    const scaleY = height / oldHeight

    this._cursor.width = width
    this._cursor.height = height
    applyStretchToMatrix(
      this._cursor.transform,
      { width, height },
      scaleX,
      scaleY
    )

    this._sceneGraph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)
  }

  public resize(ids: IDType[], width: number, height: number) {
    ids.forEach(id => this._resize(id, width, height))
  }
}
