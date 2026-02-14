import { type IDType, NodeType } from '@latte-js/bean'
import { type SceneGraph, NULL_INDEX } from '@latte-js/espresso'
import { mat2d, vec2 } from 'gl-matrix'

import { isPointInPolygon } from '../utils/geometry'

import type { Camera } from '../core/camera'

export class HitTester {
  private _tempVec = vec2.create()
  private _tempMat = mat2d.create()

  constructor(
    private _sceneGraph: SceneGraph,
    private _camera: Camera
  ) {}

  public setGraph(graph: SceneGraph) {
    this._sceneGraph = graph
  }

  public hitTest(
    screenX: number,
    screenY: number,
    rootId: IDType,
    candidates?: Set<number>
  ): number {
    const worldPoint = this._camera.toWorld(screenX, screenY)
    const p = vec2.fromValues(worldPoint.x, worldPoint.y)

    const rootIndex = this._sceneGraph.getIndex(rootId)
    if (rootIndex === NULL_INDEX) return NULL_INDEX

    return this._hitTestRecursive(rootIndex, p, candidates)
  }

  private _hitTestRecursive(
    index: number,
    point: vec2,
    candidates?: Set<number>
  ): number {
    if (!this._sceneGraph.visible[index]) {
      return NULL_INDEX
    }

    if (candidates && !candidates.has(index)) {
      return NULL_INDEX
    }

    const type = this._sceneGraph.type[index]
    const isInfiniteContainer =
      type === NodeType.DOCUMENT || type === NodeType.CANVAS

    // 1. AABB Pruning
    if (!isInfiniteContainer) {
      const aabbPtr = index * 4
      const minX = this._sceneGraph.aabb[aabbPtr]
      const minY = this._sceneGraph.aabb[aabbPtr + 1]
      const maxX = this._sceneGraph.aabb[aabbPtr + 2]
      const maxY = this._sceneGraph.aabb[aabbPtr + 3]

      const eps = 0.001
      if (
        point[0] < minX - eps ||
        point[0] > maxX + eps ||
        point[1] < minY - eps ||
        point[1] > maxY + eps
      ) {
        return NULL_INDEX
      }
    }

    let child = this._sceneGraph.lastChild[index]
    while (child !== NULL_INDEX) {
      const hit = this._hitTestRecursive(child, point, candidates)
      if (hit !== NULL_INDEX) {
        return hit
      }
      child = this._sceneGraph.prevSibling[child]
    }

    // 3. Self Check (Exact Hit)
    if (this._isPointInNode(index, point)) {
      return index
    }

    return NULL_INDEX
  }

  private _isPointInNode(index: number, point: vec2): boolean {
    const type = this._sceneGraph.type[index]

    // Groups are transparent containers, but Canvas/Document are interactive infinite backgrounds
    if (type === NodeType.GROUP) {
      return false
    }
    if (type === NodeType.CANVAS || type === NodeType.DOCUMENT) {
      return true
    }

    // Transform point to local space
    // Node's world matrix transforms local -> world
    // We need world -> local, so we use inverse world matrix

    // Retrieve world matrix
    const matPtr = index * 6
    const a = this._sceneGraph.worldMatrix[matPtr]
    const b = this._sceneGraph.worldMatrix[matPtr + 1]
    const c = this._sceneGraph.worldMatrix[matPtr + 2]
    const d = this._sceneGraph.worldMatrix[matPtr + 3]
    const tx = this._sceneGraph.worldMatrix[matPtr + 4]
    const ty = this._sceneGraph.worldMatrix[matPtr + 5]

    mat2d.set(this._tempMat, a, b, c, d, tx, ty)
    mat2d.invert(this._tempMat, this._tempMat)

    vec2.transformMat2d(this._tempVec, point, this._tempMat)

    if (
      type === NodeType.POLYGON ||
      type === NodeType.STAR ||
      type === NodeType.PATH
    ) {
      return this._isPointInIrregularShape(index, this._tempVec)
    }

    // Check bounds in local space
    // For now, simple rect check (0,0 to width,height)
    const width = this._sceneGraph.size[index * 2]
    const height = this._sceneGraph.size[index * 2 + 1]

    if (type === NodeType.ELLIPSE) {
      const rx = width / 2
      const ry = height / 2
      const cx = rx
      const cy = ry
      const dx = this._tempVec[0] - cx
      const dy = this._tempVec[1] - cy
      return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1
    }

    return (
      this._tempVec[0] >= 0 &&
      this._tempVec[0] <= width &&
      this._tempVec[1] >= 0 &&
      this._tempVec[1] <= height
    )
  }

  private _isPointInIrregularShape(index: number, localPoint: vec2): boolean {
    const blobPtr = this._sceneGraph.blobIndexToPtr.get(index)
    if (!blobPtr) return false

    // Assuming blob data contains points for polygon/star/path
    // This is a simplified assumption. Real implementation depends on data schema.
    const data = this._sceneGraph.blobs.read<{ points: number[] }>(blobPtr)
    if (!data || !data.points) return false

    return isPointInPolygon(localPoint, data.points)
  }
}
