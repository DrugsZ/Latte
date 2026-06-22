import { NodeLifecycle, NULL_INDEX, type SceneGraph } from '@latte-js/espresso'

import type { Camera } from '@latte-js/art'
import type { IDType } from '@latte-js/bean'

export type ResizeHandleDirection =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'

export interface OverlayBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export interface ViewportRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface InteractionGroup {
  readonly ids: readonly IDType[]
  readonly worldBounds: OverlayBounds
  readonly viewportBounds: ViewportRect
}

export interface SelectionOverlayHandle {
  readonly id: string
  readonly type: 'resize-handle'
  readonly direction: ResizeHandleDirection
  readonly viewportBounds: ViewportRect
}

export interface SelectionOverlayGeometry {
  readonly group: InteractionGroup
  readonly handles: readonly SelectionOverlayHandle[]
}

export interface SelectionOverlayGeometryOptions {
  readonly sceneGraph: SceneGraph
  readonly selectionIds: readonly IDType[]
  readonly activeRootId?: IDType | null
  readonly camera: Camera
}

const HANDLE_SIZE = 8

const HANDLE_DIRECTIONS: readonly ResizeHandleDirection[] = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
]

export class SelectionOverlayGeometryBuilder {
  public build(
    options: SelectionOverlayGeometryOptions
  ): SelectionOverlayGeometry | null {
    const { sceneGraph, selectionIds, activeRootId, camera } = options
    if (selectionIds.length === 0 || !activeRootId) {
      return null
    }

    const activeRootIndex = sceneGraph.getIndex(activeRootId)
    if (activeRootIndex === NULL_INDEX) {
      return null
    }

    const ids: IDType[] = []
    let worldBounds: OverlayBounds | null = null

    for (const id of selectionIds) {
      const index = sceneGraph.getIndex(id)
      if (
        index === NULL_INDEX ||
        !this._isSelectableNode(sceneGraph, index, activeRootIndex)
      ) {
        continue
      }

      const bounds = this._readWorldBounds(sceneGraph, index)
      if (!bounds) {
        continue
      }

      ids.push(id)
      worldBounds = worldBounds
        ? this._unionBounds(worldBounds, bounds)
        : bounds
    }

    if (
      !worldBounds ||
      !this._intersects(worldBounds, camera.getViewportBounds())
    ) {
      return null
    }

    const viewportBounds = this._worldToViewportBounds(worldBounds, camera)
    return {
      group: {
        ids,
        worldBounds,
        viewportBounds,
      },
      handles: this._createHandles(viewportBounds),
    }
  }

  private _isSelectableNode(
    sceneGraph: SceneGraph,
    index: number,
    activeRootIndex: number
  ) {
    let current = index
    const visited = new Set<number>()

    while (current !== NULL_INDEX) {
      if (visited.has(current)) {
        return false
      }
      visited.add(current)

      if (
        (sceneGraph.lifecycle[current] & NodeLifecycle.Active) === 0 ||
        sceneGraph.visible[current] !== 1
      ) {
        return false
      }

      if (current === activeRootIndex) {
        return true
      }

      current = sceneGraph.parent[current]
    }

    return false
  }

  private _readWorldBounds(
    sceneGraph: SceneGraph,
    index: number
  ): OverlayBounds | null {
    const ptr = index * 4
    const bounds = {
      minX: sceneGraph.aabb[ptr],
      minY: sceneGraph.aabb[ptr + 1],
      maxX: sceneGraph.aabb[ptr + 2],
      maxY: sceneGraph.aabb[ptr + 3],
    }

    if (
      !Number.isFinite(bounds.minX) ||
      !Number.isFinite(bounds.minY) ||
      !Number.isFinite(bounds.maxX) ||
      !Number.isFinite(bounds.maxY) ||
      bounds.minX >= bounds.maxX ||
      bounds.minY >= bounds.maxY
    ) {
      return null
    }

    return bounds
  }

  private _unionBounds(a: OverlayBounds, b: OverlayBounds): OverlayBounds {
    return {
      minX: Math.min(a.minX, b.minX),
      minY: Math.min(a.minY, b.minY),
      maxX: Math.max(a.maxX, b.maxX),
      maxY: Math.max(a.maxY, b.maxY),
    }
  }

  private _intersects(a: OverlayBounds, b: OverlayBounds) {
    const viewport = this._normalizeBounds(b)
    return (
      a.minX <= viewport.maxX &&
      a.maxX >= viewport.minX &&
      a.minY <= viewport.maxY &&
      a.maxY >= viewport.minY
    )
  }

  private _normalizeBounds(bounds: OverlayBounds): OverlayBounds {
    return {
      minX: Math.min(bounds.minX, bounds.maxX),
      minY: Math.min(bounds.minY, bounds.maxY),
      maxX: Math.max(bounds.minX, bounds.maxX),
      maxY: Math.max(bounds.minY, bounds.maxY),
    }
  }

  private _worldToViewportBounds(
    bounds: OverlayBounds,
    camera: Camera
  ): ViewportRect {
    const points = [
      camera.toScreen(bounds.minX, bounds.minY),
      camera.toScreen(bounds.maxX, bounds.minY),
      camera.toScreen(bounds.maxX, bounds.maxY),
      camera.toScreen(bounds.minX, bounds.maxY),
    ]
    const xs = points.map(point => point.x)
    const ys = points.map(point => point.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }

  private _createHandles(bounds: ViewportRect): SelectionOverlayHandle[] {
    const x0 = bounds.x
    const y0 = bounds.y
    const x1 = bounds.x + bounds.width
    const y1 = bounds.y + bounds.height
    const cx = bounds.x + bounds.width / 2
    const cy = bounds.y + bounds.height / 2
    const positions: Record<ResizeHandleDirection, { x: number; y: number }> = {
      nw: { x: x0, y: y0 },
      n: { x: cx, y: y0 },
      ne: { x: x1, y: y0 },
      e: { x: x1, y: cy },
      se: { x: x1, y: y1 },
      s: { x: cx, y: y1 },
      sw: { x: x0, y: y1 },
      w: { x: x0, y: cy },
    }

    return HANDLE_DIRECTIONS.map(direction => ({
      id: `resize-${direction}`,
      type: 'resize-handle',
      direction,
      viewportBounds: this._centeredRect(positions[direction], HANDLE_SIZE),
    }))
  }

  private _centeredRect(
    point: { x: number; y: number },
    size: number
  ): ViewportRect {
    return {
      x: point.x - size / 2,
      y: point.y - size / 2,
      width: size,
      height: size,
    }
  }
}
