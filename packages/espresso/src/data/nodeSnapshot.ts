import {
  isFrame,
  isPage,
  isRect,
  NodeType,
  type IDType,
  type ILatteNode,
  type IParentIndex,
} from '@latte-js/bean'

import { NULL_INDEX } from './config'
import { readNodeFills, readNodeName, readNodeStrokes } from './nodeProps'
import { StyleOps } from './ops/styleOps'
import { TransformOps } from './ops/transformOps'
import type { SceneGraph } from './sceneGraph'

export interface INodePlacement {
  readonly parentId: IDType | null
  readonly position: number
}

export interface INodeLifecyclePayload extends INodePlacement {
  readonly index: number
}

const nodeTypeToKey = (type: number): keyof typeof NodeType => {
  return (NodeType[type] as keyof typeof NodeType | undefined) ?? 'GROUP'
}

export const getChildPosition = (graph: SceneGraph, index: number) => {
  const parent = graph.parent[index]
  if (parent === NULL_INDEX) {
    return 0
  }

  let position = 1
  let child = graph.firstChild[parent]
  while (child !== NULL_INDEX) {
    if (child === index) {
      return position
    }
    child = graph.nextSibling[child]
    position += 1
  }

  return position
}

export const getNodePlacement = (
  graph: SceneGraph,
  index: number
): INodePlacement => {
  const parent = graph.parent[index]
  return {
    parentId: parent === NULL_INDEX ? null : graph.getUUID(parent),
    position: getChildPosition(graph, index),
  }
}

export const getNodeLifecyclePayload = (
  graph: SceneGraph,
  index: number
): INodeLifecyclePayload => ({
  index,
  ...getNodePlacement(graph, index),
})

export const captureNodeSnapshot = (
  graph: SceneGraph,
  index: number
): ILatteNode => {
  graph.assertNodeIndexAlive(index, 'captureNodeSnapshot')

  const type = graph.type[index] as NodeType
  const guid = graph.getUUID(index) as IDType | null
  if (!guid) {
    throw new Error(`[NodeSnapshot] Cannot snapshot node without id: ${index}`)
  }

  const parent = graph.parent[index]
  let parentIndex: IParentIndex | undefined
  if (parent !== NULL_INDEX) {
    const parentId = graph.getUUID(parent)
    if (parentId) {
      parentIndex = {
        guid: parentId,
        position: String(getChildPosition(graph, index)),
      }
    }
  }

  const node = {
    type: nodeTypeToKey(type),
    guid,
    name: readNodeName(graph, index),
    visible: StyleOps.getVisible(graph, index),
    opacity: StyleOps.getOpacity(graph, index),
    locked: StyleOps.getLocked(graph, index),
    transform: Array.from(TransformOps.getMatrix(graph, index)),
    size: {
      x: TransformOps.getWidth(graph, index),
      y: TransformOps.getHeight(graph, index),
    },
    strokeWeight: StyleOps.getStrokeWeight(graph, index),
    strokeAlign: StyleOps.getStrokeAlign(graph, index),
    strokeJoin: StyleOps.getStrokeJoin(graph, index),
    strokeStyle: StyleOps.getStrokeStyle(graph, index),
    dashCap: StyleOps.getDashCap(graph, index),
    ...(parentIndex ? { parentIndex } : {}),
  } as unknown as ILatteNode

  const fills = readNodeFills(graph, index)
  const strokes = readNodeStrokes(graph, index)
  if (isPage(node)) {
    node.backgrounds = fills
  } else if (isFrame(node) || isRect(node)) {
    node.fillPaints = fills
  }
  if (strokes.length > 0) {
    node.strokePaints = strokes
  }

  return node
}
