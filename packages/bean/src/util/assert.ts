import { NodeType } from '../schema'

import type {
  ContainerNode,
  ICircleNode,
  IEllipseNode,
  IFrameNode,
  IGroupNode,
  ILatteDocumentNode,
  ILatteNode,
  ILineNode,
  IPageNode,
  IPathNode,
  IPolygonNode,
  IRectangleNode,
  IStarNode,
  ITextNode,
} from '../schema'

export function isFrame(node: ILatteNode): node is IFrameNode {
  return node.type === NodeType[NodeType.FRAME]
}

export function isPage(node: ILatteNode): node is IPageNode {
  return node.type === NodeType[NodeType.CANVAS]
}

export function isDocument(node: ILatteNode): node is ILatteDocumentNode {
  return node.type === NodeType[NodeType.DOCUMENT]
}

export function isGroup(node: ILatteNode): node is IGroupNode {
  return node.type === NodeType[NodeType.GROUP]
}

export function isContainerNode(node: ILatteNode): node is ContainerNode {
  return (NodeType[node.type] & NodeType.DOCUMENT) !== 0
}

export function isRect(node: ILatteNode): node is IRectangleNode {
  return node.type === NodeType[NodeType.RECTANGLE]
}

export function isEllipse(node: ILatteNode): node is IEllipseNode {
  return node.type === NodeType[NodeType.ELLIPSE]
}

export function isCircle(node: ILatteNode): node is ICircleNode {
  return node.type === NodeType[NodeType.CIRCLE]
}

export function isText(node: ILatteNode): node is ITextNode {
  return node.type === NodeType[NodeType.TEXT]
}

export function isPath(node: ILatteNode): node is IPathNode {
  return node.type === NodeType[NodeType.PATH]
}

export function isLine(node: ILatteNode): node is ILineNode {
  return node.type === NodeType[NodeType.LINE]
}

export function isPolygon(node: ILatteNode): node is IPolygonNode {
  return node.type === NodeType[NodeType.POLYGON]
}

export function isStar(node: ILatteNode): node is IStarNode {
  return node.type === NodeType[NodeType.STAR]
}
