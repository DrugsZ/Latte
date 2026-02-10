import { NodeType, type ILatteFile, type ILatteNode } from '@latte-js/bean'
import { mat2d } from 'gl-matrix'

import { NULL_INDEX } from '../data/config'
import { NodeCursor } from '../data/nodeCursor'
import { TransformOps } from '../data/ops'

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
        return Number(a.parentIndex!.position) - Number(b.parentIndex!.position)
      })

      let prevIdx = NULL_INDEX

      for (let i = 0; i < childrenNodes.length; i++) {
        const childNode = childrenNodes[i]
        const childIdx = idMap.get(childNode.guid)!

        this._graph.parent[childIdx] = parentIdx

        if (i === 0) {
          this._graph.firstChild[parentIdx] = childIdx
        } else {
          this._graph.nextSibling[prevIdx] = childIdx
          this._graph.prevSibling[childIdx] = prevIdx // 双向
        }

        prevIdx = childIdx
      }

      if (prevIdx !== NULL_INDEX) {
        this._graph.lastChild[parentIdx] = prevIdx
      }
    }

    // this._updateWorldTransforms(idMap)

    return this._graph.getUUIDMap()
  }

  public convertNode(node: ILatteNode): number {
    const typeNum = mapType(node.type as keyof typeof NodeType)
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
    if (transform) {
      this._node.transform = transform
    }
    if (size) {
      this._node.width = size.x
      this._node.height = size.y
    }
    this._node.visible = visible
    this._node.opacity = opacity
    this._node.locked = locked
    this._node.strokeWeight = strokeWeight
    this._node.strokeAlign = strokeAlign
    this._node.strokeJoin = strokeJoin
    this._node.strokeStyle = strokeStyle
    this._node.dashCap = dashCap

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
