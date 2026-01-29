import type { IDType } from '@latte-js/bean'
import {
  type SceneGraph,
  NodeCursor,
  DIRTY_TRANSFORM,
  DIRTY_AABB,
  NULL_INDEX,
  computeStretchTransform,
  extractMat2,
} from '@latte-js/espresso'
import { mat2, mat2d, vec2 } from 'gl-matrix'
import { system, Systems, SystemBase } from './systems'

type ISnapshot = Float32Array

/**
 * Recursively apply deformation (stretch/scale) to a node and all its descendants.
 *
 * Algorithm (Deformation Tensor Propagation):
 * - Instead of accumulating rotations from root, we propagate the "Deformation Tensor" (D).
 * - D represents how the coordinate space is stretched at the current node's parent frame.
 *
 * For a node C with parent P:
 * 1. Receive D_parent (Deformation in Parent's frame).
 * 2. Update Position: P_new = D_parent * P_old.
 *    (The position is a vector in Parent's frame, so it transforms by D_parent).
 * 3. Compute Local Deformation D_local:
 *    D_local = R^T * D_parent * R
 *    (Project the parent's deformation into the local aligned frame).
 * 4. Update Size:
 *    The local axes (1,0) and (0,1) are deformed by D_local.
 *    New Width Scale = |D_local * (1,0)|
 *    New Height Scale = |D_local * (0,1)|
 * 5. Recurse with D_local.
 *
 * This is mathematically equivalent to the Accumulated Matrix approach but simpler (O(1) state).
 * It correctly handles deep nesting by maintaining the local deformation state.
 */
function applyDeformationToDescendants(
  graph: SceneGraph,
  cursor: NodeCursor,
  index: number,
  parentDeformation: mat2
) {
  cursor.to(index)

  // 1. Update Position
  // P_new = D_parent * P_old
  const oldX = cursor.x
  const oldY = cursor.y
  cursor.x = parentDeformation[0] * oldX + parentDeformation[2] * oldY
  cursor.y = parentDeformation[1] * oldX + parentDeformation[3] * oldY

  // 2. Compute Local Deformation
  // D_local = R^T * D_parent * R
  const rotation = extractMat2(cursor.transform) // R
  const rotationInv = mat2.transpose(mat2.create(), rotation) // R^T

  // temp = D_parent * R
  const temp = mat2.multiply(mat2.create(), parentDeformation, rotation)
  // D_local = R^T * temp
  const localDeformation = mat2.multiply(mat2.create(), rotationInv, temp)

  // 3. Update Size
  // Extract scale factors from the deformed axes
  // col0 = D_local * (1, 0) = [m00, m01]
  // col1 = D_local * (0, 1) = [m10, m11]
  const widthScale = Math.sqrt(
    localDeformation[0] * localDeformation[0] +
      localDeformation[1] * localDeformation[1]
  )
  const heightScale = Math.sqrt(
    localDeformation[2] * localDeformation[2] +
      localDeformation[3] * localDeformation[3]
  )

  cursor.width *= widthScale
  cursor.height *= heightScale

  graph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)

  // 4. Recurse
  let child = graph.firstChild[index]
  while (child !== NULL_INDEX) {
    applyDeformationToDescendants(graph, cursor, child, localDeformation)
    child = graph.nextSibling[child]
  }
}

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

    // Handle zero-size case: just set new size directly
    if (oldWidth === 0 || oldHeight === 0) {
      this._cursor.width = width
      this._cursor.height = height
      this._sceneGraph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)
      return
    }

    // Calculate scale factors at the top level
    const scaleX = width / oldWidth
    const scaleY = height / oldHeight

    // For the root node being resized, we don't apply stretch to its own transform
    // (the root node's rotation should be preserved, only its size changes)
    // But we do need to update the root's size directly
    this._cursor.width = width
    this._cursor.height = height
    this._sceneGraph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)

    // Recursively apply stretch to all children
    // The parent's local space is deformed by (scaleX, scaleY)
    const deformation = mat2.fromValues(scaleX, 0, 0, scaleY)
    let child = this._sceneGraph.firstChild[index]
    while (child !== NULL_INDEX) {
      applyDeformationToDescendants(
        this._sceneGraph,
        this._cursor,
        child,
        deformation
      )
      child = this._sceneGraph.nextSibling[child]
    }
  }

  public resize(ids: IDType[], width: number, height: number) {
    ids.forEach(id => this._resize(id, width, height))
  }
}
