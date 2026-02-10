import {
  isFrame,
  isPage,
  isRect,
  NodeType,
  type IDType,
  type ILatteFile,
  type ILatteNode,
  type IParentIndex,
} from '@latte-js/bean'

const nodeTypeToKey = (type: number): string => {
  return NodeType[type] || 'GROUP'
}

import { NULL_INDEX } from '../data/config'
import { NodeCursor } from '../data/nodeCursor'

import type { SceneGraph } from '../data/sceneGraph'

export class Serializer {
  private _node: NodeCursor

  constructor(private _graph: SceneGraph) {
    this._node = new NodeCursor(_graph, NULL_INDEX)
  }

  public serialize(): ILatteFile {
    const elements: ILatteNode[] = []

    const generations = this._graph.allocator.generations
    for (let i = 0; i < generations.length; i++) {
      if (this._graph.allocator.isValid(i, generations[i])) {
        const node = this._readNode(i)
        if (node.guid) {
          elements.push(node)
        }
      }
    }

    return { elements }
  }

  private _readNode(index: number): ILatteNode {
    this._node.to(index)

    const type = this._node.type as NodeType
    const guid = this._node.id as IDType

    const parent = this._node.parent
    let parentIndex: IParentIndex | undefined

    if (parent) {
      // Find position among siblings
      let position = '0'
      let curr = this._graph.firstChild[parent.index]
      let count = 0
      while (curr !== NULL_INDEX) {
        if (curr === index) {
          position = (count + 1).toString()
          break
        }
        curr = this._graph.nextSibling[curr]
        count++
      }

      parentIndex = {
        guid: parent.id as IDType,
        position,
      }
    }

    const node = {
      type: nodeTypeToKey(type),
      guid,
      name: this._node.name,
      visible: this._node.visible,
      opacity: this._node.opacity,
      locked: this._node.locked,
      transform: Array.from(this._node.transform),
      size: {
        x: this._node.width,
        y: this._node.height,
      },
      strokeWeight: this._node.strokeWeight,
      strokeAlign: this._node.strokeAlign,
      strokeJoin: this._node.strokeJoin,
      strokeStyle: this._node.strokeStyle,
      dashCap: this._node.dashCap,
      ...(parentIndex ? { parentIndex } : {}),
    } as unknown as ILatteNode

    const fills = this._node.fills
    if (isPage(node)) {
      node.backgrounds = fills
    } else if (isFrame(node) || isRect(node)) {
      node.fillPaints = fills
    }

    return node
  }

  public toJSON(compress = false): string {
    const data = this.serialize()
    return compress ? JSON.stringify(data) : JSON.stringify(data, null, 2)
  }
}
