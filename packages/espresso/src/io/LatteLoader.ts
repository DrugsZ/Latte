import { NodeCursor } from '../data/nodeCursor'
import { NULL_INDEX } from '../data/config'
import type { SceneGraph } from '../data/sceneGraph'
import { NodeType, type ILatteNode, type ILatteFile } from '@latte-js/bean'

const mapType = (typeStr: keyof typeof NodeType): number => {
  return NodeType[typeStr as keyof typeof NodeType] ?? NodeType.GROUP
}

const DEFAULT_ROOT = 'root:parent'

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

      const pid = node.parentIndex || {
        guid: DEFAULT_ROOT,
        position: '1',
      }
      if (!groups.has(pid.guid)) {
        groups.set(pid.guid, [])
      }
      groups.get(pid.guid)!.push(node)
    }

    for (const [parentIdStr, childrenNodes] of groups) {
      if (!idMap.has(parentIdStr) && parentIdStr !== DEFAULT_ROOT) continue

      const parentIdx = idMap.get(parentIdStr) ?? NULL_INDEX

      childrenNodes.sort((a, b) => {
        return Number(a.parentIndex.position) - Number(b.parentIndex.position)
      })

      let prevIdx = NULL_INDEX

      for (let i = 0; i < childrenNodes.length; i++) {
        const childNode = childrenNodes[i]
        const childIdx = idMap.get(childNode.guid)!

        if (parentIdx !== NULL_INDEX) {
          this._graph.parent[childIdx] = parentIdx
        }

        if (i === 0) {
          if (parentIdx !== NULL_INDEX) {
            this._graph.firstChild[parentIdx] = childIdx
          }
        } else {
          this._graph.nextSibling[prevIdx] = childIdx
          this._graph.prevSibling[childIdx] = prevIdx // 双向
        }

        prevIdx = childIdx
      }

      if (parentIdx !== NULL_INDEX && prevIdx !== NULL_INDEX) {
        this._graph.lastChild[parentIdx] = prevIdx
      }
    }
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
    if ('fillPaints' in node && node.fillPaints) {
      this._node.fills = node.fillPaints
    }
  }
}
