import { NodeType, type AABB } from '@latte-js/bean'
import {
  type SceneGraph,
  DIRTY_TRANSFORM,
  NodeCursor,
  TransformOps,
} from '@latte-js/espresso'

export class AabbSystem {
  private _cursor: NodeCursor
  private _tempAABB: AABB = Float32Array.from({ length: 4 })
  private _queue: number[] = []
  constructor(private _scene: SceneGraph) {
    this._cursor = new NodeCursor(this._scene, -1)
  }

  public process(map: Map<number, number>) {
    for (const [index, flags] of map) {
      if (flags & DIRTY_TRANSFORM) {
        this._queue.push(index)
      }
    }
    this._startProcess()
  }

  private _startProcess() {
    while (this._queue.length > 0) {
      const index = this._queue.shift()!
      this._cursor.to(index)
      this._updateAABB(index)
      if (this._cursor.type & NodeType.DOCUMENT) {
        this._cursor.children().forEach(child => {
          this._queue.push(child.index)
        })
      }
    }
  }

  private _updateAABB(index: number): AABB {
    const { x, y, width, height, transform } = this._cursor

    const corners = [
      { x: -width / 2, y: 0 },
      { x: width / 2, y: 0 },
      { x: width / 2, y: height },
      { x: -width / 2, y: height },
    ]

    let minX = Infinity,
      minY = Infinity
    let maxX = -Infinity,
      maxY = -Infinity

    for (const corner of corners) {
      const transformedX =
        transform[0] * corner.x + transform[2] * corner.y + transform[4]
      const transformedY =
        transform[1] * corner.x + transform[3] * corner.y + transform[5]

      minX = Math.min(minX, transformedX)
      minY = Math.min(minY, transformedY)
      maxX = Math.max(maxX, transformedX)
      maxY = Math.max(maxY, transformedY)
    }

    this._tempAABB[0] = minX + x
    this._tempAABB[1] = minY + y
    this._tempAABB[2] = maxX + x
    this._tempAABB[3] = maxY + y
    // update aabb should not mark dirty,
    TransformOps.setAABB(this._scene, index, this._tempAABB)
    return this._tempAABB
  }
}
