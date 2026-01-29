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
 * Recursively apply stretch to a node and all its descendants.
 *
 * Algorithm (Accumulated Matrix Approach):
 * - Accumulate rotation matrices from Root to current node
 * - Position: transform using M^(-1) * S * M where M is parent's accumulated rotation
 * - Size: scale using the stretch factors in the node's local coordinate system
 * - Transform: keep original rotation unchanged (no shear added)
 *
 * This ensures all nodes' world positions scale correctly by (scaleX, scaleY)
 * while preserving their rotation and keeping them as rectangles (no shear).
 *
 * @param graph Scene graph
 * @param cursor Node cursor
 * @param index Current node index
 * @param scaleX Top-level node X scale factor
 * @param scaleY Top-level node Y scale factor
 * @param accumulatedMatrix Accumulated rotation from Root to parent (exclusive of current node)
 */
function applyStretchToDescendants(
  graph: SceneGraph,
  cursor: NodeCursor,
  index: number,
  scaleX: number,
  scaleY: number,
  accumulatedMatrix: mat2
) {
  cursor.to(index)

  // Get the current node's local rotation (pure rotation, no shear)
  const nodeLocalMatrix = extractMat2(cursor.transform)

  // Accumulated rotation from Root to this node
  const nodeAccumulatedMatrix = mat2.multiply(
    mat2.create(),
    accumulatedMatrix,
    nodeLocalMatrix
  )

  // Position transform: M^(-1) * S * M where M is parent's accumulated rotation
  // This transforms position from parent coords to Root coords, scales, then back
  const positionStretchTransform = computeStretchTransform(
    accumulatedMatrix,
    scaleX,
    scaleY
  )

  const oldX = cursor.x
  const oldY = cursor.y
  cursor.x =
    positionStretchTransform[0] * oldX + positionStretchTransform[2] * oldY
  cursor.y =
    positionStretchTransform[1] * oldX + positionStretchTransform[3] * oldY

  // Size transform: compute how much the local axes scale
  // The stretch in node's local coordinate system
  const sizeStretchTransform = computeStretchTransform(
    nodeAccumulatedMatrix,
    scaleX,
    scaleY
  )

  // Extract scale factors for width and height
  // width scales by |sizeStretch * (1, 0)|, height scales by |sizeStretch * (0, 1)|
  const widthScale = Math.sqrt(
    sizeStretchTransform[0] * sizeStretchTransform[0] +
      sizeStretchTransform[1] * sizeStretchTransform[1]
  )
  const heightScale = Math.sqrt(
    sizeStretchTransform[2] * sizeStretchTransform[2] +
      sizeStretchTransform[3] * sizeStretchTransform[3]
  )

  cursor.width = cursor.width * widthScale
  cursor.height = cursor.height * heightScale

  // Transform: keep original rotation, do not add shear
  // (cursor.transform remains unchanged)

  graph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)

  // Recursively apply to children using ORIGINAL node's rotation for accumulation
  // This is critical: we use the original rotation, not modified transform
  let child = graph.firstChild[index]
  while (child !== NULL_INDEX) {
    applyStretchToDescendants(
      graph,
      cursor,
      child,
      scaleX,
      scaleY,
      nodeAccumulatedMatrix
    )
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
    // For direct children of root, parentToRootMatrix = Identity (their position is already in Root coords)
    const identityMat2 = mat2.create()
    let child = this._sceneGraph.firstChild[index]
    while (child !== NULL_INDEX) {
      applyStretchToDescendants(
        this._sceneGraph,
        this._cursor,
        child,
        scaleX,
        scaleY,
        identityMat2
      )
      child = this._sceneGraph.nextSibling[child]
    }
  }

  public resize(ids: IDType[], width: number, height: number) {
    ids.forEach(id => this._resize(id, width, height))
  }
}
