import { NodeLifecycle, NULL_INDEX, type SceneGraph } from '@latte-js/espresso'

import { SelectionOverlayHitType } from './selectionOverlayConstants'

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

export interface ViewportPoint {
  readonly x: number
  readonly y: number
}

export type ViewportQuad = readonly [
  ViewportPoint,
  ViewportPoint,
  ViewportPoint,
  ViewportPoint,
]

type WorldQuad = readonly [
  ViewportPoint,
  ViewportPoint,
  ViewportPoint,
  ViewportPoint,
]

export interface InteractionGroup {
  readonly ids: readonly IDType[]
  readonly worldBounds: OverlayBounds
  readonly viewportBounds: ViewportRect
  readonly viewportCorners: ViewportQuad
}

export interface SelectionOverlayHandle {
  readonly id: string
  readonly type: SelectionOverlayHitType.ResizeHandle
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

interface SelectionOverlayItem {
  readonly id: IDType
  readonly worldBounds: OverlayBounds
  readonly worldCorners?: WorldQuad
}

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

    const items: SelectionOverlayItem[] = []
    let worldBounds: OverlayBounds | null = null

    for (const id of selectionIds) {
      const index = sceneGraph.getIndex(id)
      if (
        index === NULL_INDEX ||
        !this._isSelectableNode(sceneGraph, index, activeRootIndex)
      ) {
        continue
      }

      const item = this._readSelectionItem(sceneGraph, index, id)
      if (!item) {
        continue
      }

      items.push(item)
      worldBounds = worldBounds
        ? this._unionBounds(worldBounds, item.worldBounds)
        : item.worldBounds
    }

    if (
      !worldBounds ||
      !this._intersects(worldBounds, camera.getViewportBounds())
    ) {
      return null
    }

    const viewportCorners =
      items.length === 1 && items[0].worldCorners
        ? this._worldToViewportCorners(items[0].worldCorners, camera)
        : this._worldBoundsToViewportCorners(worldBounds, camera)
    const viewportBounds = this._viewportBoundsFromCorners(viewportCorners)
    return {
      group: {
        ids: items.map(item => item.id),
        worldBounds,
        viewportBounds,
        viewportCorners,
      },
      handles: this._createHandles(viewportCorners),
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

  private _readSelectionItem(
    sceneGraph: SceneGraph,
    index: number,
    id: IDType
  ): SelectionOverlayItem | null {
    const bounds = this._readWorldBounds(sceneGraph, index)
    if (!bounds) {
      return null
    }

    const worldCorners = this._readWorldCorners(sceneGraph, index)
    if (worldCorners) {
      return {
        id,
        worldCorners,
        worldBounds: this._boundsFromPoints(worldCorners),
      }
    }

    return {
      id,
      worldBounds: bounds,
    }
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

  private _readWorldCorners(
    sceneGraph: SceneGraph,
    index: number
  ): WorldQuad | null {
    const width = sceneGraph.size[index * 2]
    const height = sceneGraph.size[index * 2 + 1]
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      return null
    }

    const ptr = index * 6
    const a = sceneGraph.worldMatrix[ptr]
    const b = sceneGraph.worldMatrix[ptr + 1]
    const c = sceneGraph.worldMatrix[ptr + 2]
    const d = sceneGraph.worldMatrix[ptr + 3]
    const tx = sceneGraph.worldMatrix[ptr + 4]
    const ty = sceneGraph.worldMatrix[ptr + 5]

    if (![a, b, c, d, tx, ty].every(Number.isFinite)) {
      return null
    }

    const transform = (x: number, y: number): ViewportPoint => ({
      x: a * x + c * y + tx,
      y: b * x + d * y + ty,
    })

    return [
      transform(0, 0),
      transform(width, 0),
      transform(width, height),
      transform(0, height),
    ]
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

  private _boundsFromPoints(points: readonly ViewportPoint[]): OverlayBounds {
    const xs = points.map(point => point.x)
    const ys = points.map(point => point.y)
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    }
  }

  private _worldToViewportCorners(
    corners: WorldQuad,
    camera: Camera
  ): ViewportQuad {
    return corners.map(point =>
      camera.toScreen(point.x, point.y)
    ) as unknown as ViewportQuad
  }

  private _worldBoundsToViewportCorners(
    bounds: OverlayBounds,
    camera: Camera
  ): ViewportQuad {
    return [
      camera.toScreen(bounds.minX, bounds.minY),
      camera.toScreen(bounds.maxX, bounds.minY),
      camera.toScreen(bounds.maxX, bounds.maxY),
      camera.toScreen(bounds.minX, bounds.maxY),
    ]
  }

  private _viewportBoundsFromCorners(corners: ViewportQuad): ViewportRect {
    const bounds = this._boundsFromPoints(corners)
    return {
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
    }
  }

  private _createHandles(corners: ViewportQuad): SelectionOverlayHandle[] {
    const [nw, ne, se, sw] = corners
    const mid = (a: ViewportPoint, b: ViewportPoint): ViewportPoint => ({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    })
    const positions: Record<ResizeHandleDirection, { x: number; y: number }> = {
      nw,
      n: mid(nw, ne),
      ne,
      e: mid(ne, se),
      se,
      s: mid(se, sw),
      sw,
      w: mid(sw, nw),
    }

    return HANDLE_DIRECTIONS.map(direction => ({
      id: `resize-${direction}`,
      type: SelectionOverlayHitType.ResizeHandle,
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
