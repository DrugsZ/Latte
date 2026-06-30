import {
  InteractionGroupResolver,
  NodeLifecycle,
  NULL_INDEX,
  type InteractionGroupBox,
  type SceneGraph,
} from '@latte-js/espresso'

import { SelectionOverlayHitType } from './selectionOverlayConstants'

import type { Camera } from '@latte-js/art'
import type { IDType, ResizeHandleDirection } from '@latte-js/bean'

export type { ResizeHandleDirection } from '@latte-js/bean'

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

type WorldMatrix = readonly [number, number, number, number, number, number]

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

interface SelectionOverlayTarget {
  readonly id: IDType
  readonly index: number
}

interface SelectionOverlayBaseBox {
  readonly width: number
  readonly height: number
  readonly matrix: WorldMatrix
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

    const targets: SelectionOverlayTarget[] = []
    const baseBoxes = new Map<number, SelectionOverlayBaseBox | null>()
    const readBaseBox = (index: number) => {
      if (!baseBoxes.has(index)) {
        baseBoxes.set(index, this._readBaseBox(sceneGraph, index))
      }
      return baseBoxes.get(index) ?? null
    }

    for (const id of selectionIds) {
      const index = sceneGraph.getIndex(id)
      if (
        index === NULL_INDEX ||
        !this._isSelectableNode(sceneGraph, index, activeRootIndex)
      ) {
        continue
      }

      targets.push({ id, index })
    }

    const groupBox = new InteractionGroupResolver<SelectionOverlayTarget>({
      getBaseSize: target =>
        readBaseBox(target.index) ?? { width: 0, height: 0 },
      getBaseWorldMatrix: target =>
        readBaseBox(target.index)?.matrix ?? [1, 0, 0, 1, 0, 0],
    }).resolve(targets)

    if (!groupBox) {
      return null
    }

    const worldCorners = this._boxToWorldCorners(groupBox)
    const worldBounds = this._boundsFromPoints(worldCorners)

    if (!this._intersects(worldBounds, camera.getViewportBounds())) {
      return null
    }

    const viewportCorners = this._worldToViewportCorners(worldCorners, camera)
    const viewportBounds = this._viewportBoundsFromCorners(viewportCorners)
    return {
      group: {
        ids: groupBox.ids,
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

  private _readBaseBox(
    sceneGraph: SceneGraph,
    index: number
  ): SelectionOverlayBaseBox | null {
    const size = this._readNodeSize(sceneGraph, index)
    const matrix = this._readWorldMatrix(sceneGraph, index)
    if (size && matrix) {
      return {
        ...size,
        matrix,
      }
    }

    const bounds = this._readWorldBounds(sceneGraph, index)
    if (!bounds) {
      return null
    }

    return {
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
      matrix: [1, 0, 0, 1, bounds.minX, bounds.minY],
    }
  }

  private _readNodeSize(sceneGraph: SceneGraph, index: number) {
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

    return { width, height }
  }

  private _readWorldMatrix(
    sceneGraph: SceneGraph,
    index: number
  ): WorldMatrix | null {
    const ptr = index * 6
    const matrix: WorldMatrix = [
      sceneGraph.worldMatrix[ptr],
      sceneGraph.worldMatrix[ptr + 1],
      sceneGraph.worldMatrix[ptr + 2],
      sceneGraph.worldMatrix[ptr + 3],
      sceneGraph.worldMatrix[ptr + 4],
      sceneGraph.worldMatrix[ptr + 5],
    ]

    return matrix.every(Number.isFinite) ? matrix : null
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

  private _boxToWorldCorners(
    box: InteractionGroupBox<SelectionOverlayTarget>
  ): WorldQuad {
    const [a, b, c, d, tx, ty] = box.matrix
    const transform = (x: number, y: number): ViewportPoint => ({
      x: a * x + c * y + tx,
      y: b * x + d * y + ty,
    })

    return [
      transform(0, 0),
      transform(box.width, 0),
      transform(box.width, box.height),
      transform(0, box.height),
    ]
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
