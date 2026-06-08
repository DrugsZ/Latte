import { NodeType, type ILatteFile, type ILatteNode } from '@latte-js/bean'

import { DIRTY_LOCAL_MATRIX, DIRTY_TREE, NULL_INDEX } from '../data/config'
import { NodeCursor } from '../data/nodeCursor'

import type { SceneGraph } from '../data/sceneGraph'

const mapType = (type: string | number): number => {
  if (typeof type === 'number') {
    return type
  }
  return NodeType[type as keyof typeof NodeType] ?? NodeType.GROUP
}

export class LatteLoader {
  private _node: NodeCursor
  constructor(private _graph: SceneGraph) {
    this._node = new NodeCursor(_graph, NULL_INDEX)
  }
  public load(json: ILatteFile) {
    const nodes = json.elements

    const groups = new Map<string, ILatteNode[]>()

    const idMap = new Map<string, number>()

    for (const node of nodes) {
      const idx = this.convertNode(node)
      idMap.set(node.guid, idx)

      if (node.parentIndex) {
        const pid = node.parentIndex.guid
        if (!groups.has(pid)) {
          groups.set(pid, [])
        }
        groups.get(pid)!.push(node)
      }
    }

    for (const [parentIdStr, childrenNodes] of groups) {
      const parentIdx = idMap.get(parentIdStr) ?? NULL_INDEX
      if (parentIdx === NULL_INDEX) continue

      childrenNodes.sort((a, b) => {
        const aPosition = Number(a.parentIndex!.position)
        const bPosition = Number(b.parentIndex!.position)
        if (Number.isFinite(aPosition) && Number.isFinite(bPosition)) {
          return aPosition - bPosition
        }
        return a.parentIndex!.position.localeCompare(b.parentIndex!.position)
      })

      for (let i = 0; i < childrenNodes.length; i++) {
        const childNode = childrenNodes[i]
        const childIdx = idMap.get(childNode.guid)!

        this._graph.appendChild(parentIdx, childIdx)
        this._graph.markDirty(parentIdx, DIRTY_TREE)
        this._graph.markDirty(childIdx, DIRTY_TREE)
      }
    }

    this._graph.markDirty(0, DIRTY_LOCAL_MATRIX | DIRTY_TREE)

    return this._graph.getUUIDMap()
  }

  public convertNode(node: ILatteNode): number {
    const typeNum = mapType(node.type as keyof typeof NodeType)
    const existingIndex = this._graph.getIndex(node.guid)
    if (existingIndex !== NULL_INDEX) {
      this.writeNode(node, existingIndex)
      return existingIndex
    }

    if (typeNum === NodeType.DOCUMENT && !node.parentIndex) {
      const currentRootId = this._graph.getUUID(0)
      if (currentRootId && currentRootId !== node.guid) {
        this._graph.unregisterIdMap(currentRootId, 0)
      }
      this._graph.registerIdMap(node.guid, 0)
      this.writeNode(node, 0)
      return 0
    }

    const idx = this._graph.createNode(typeNum, node.guid)
    this.writeNode(node, idx)
    return idx
  }

  public writeNode(node: ILatteNode, index: number) {
    const {
      transform,
      size,
      visible,
      opacity,
      locked,
      strokeWeight,
      strokeAlign,
      strokeJoin,
      strokeStyle,
      dashCap,
    } = node
    this._node.to(index)
    if ('name' in node && node.name !== undefined) {
      this._node.name = node.name
    }
    if (transform) {
      this._node.transform = transform
    }
    if (size) {
      this._node.width = size.x
      this._node.height = size.y
    }
    if (visible !== undefined) {
      this._node.visible = visible
    }
    if (opacity !== undefined) {
      this._node.opacity = opacity
    }
    if (locked !== undefined) {
      this._node.locked = locked
    }
    if (strokeWeight !== undefined) {
      this._node.strokeWeight = strokeWeight
    }
    if (strokeAlign !== undefined) {
      this._node.strokeAlign = strokeAlign
    }
    if (strokeJoin !== undefined) {
      this._node.strokeJoin = strokeJoin
    }
    if (strokeStyle !== undefined) {
      this._node.strokeStyle = strokeStyle
    }
    if (dashCap !== undefined) {
      this._node.dashCap = dashCap
    }

    // Load fill paints
    if ('fillPaints' in node && node.fillPaints) {
      this._node.fills = node.fillPaints
    }

    // Load stroke paints
    if ('strokePaints' in node && node.strokePaints) {
      this._node.strokes = node.strokePaints
    }

    // Load corner radius
    if ('cornerRadius' in node) {
      const cr = (node as any).cornerRadius
      if (typeof cr === 'number') {
        this._node.cornerRadius = [cr, cr, cr, cr]
      }
    }

    // Load per-corner radius (Rectangle specific)
    if ('topLeftRadius' in node) {
      const rectNode = node as any
      this._node.cornerRadius = [
        rectNode.topLeftRadius ?? 0,
        rectNode.topRightRadius ?? 0,
        rectNode.bottomRightRadius ?? 0,
        rectNode.bottomLeftRadius ?? 0,
      ]
    }
  }
}
