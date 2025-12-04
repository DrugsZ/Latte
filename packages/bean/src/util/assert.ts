import { NodeType } from '../schema'

export function isFrameNode(nodeType: NodeType): boolean {
  return nodeType === NodeType.FRAME
}

export function isGroupNode(nodeType: NodeType): boolean {
  return nodeType === NodeType.GROUP
}

export function isContainerNode(nodeType: NodeType): boolean {
  return !!(nodeType & 128)
}

export function isRect(nodeType: NodeType): boolean {
  return nodeType === NodeType.RECT
}

export function isEllipse(nodeType: NodeType): boolean {
  return nodeType === NodeType.ELLIPSE
}

export function isCircle(nodeType: NodeType): boolean {
  return nodeType === NodeType.CIRCLE
}

export function isText(nodeType: NodeType): boolean {
  return nodeType === NodeType.TEXT
}

export function isPath(nodeType: NodeType): boolean {
  return nodeType === NodeType.PATH
}

export function isLine(nodeType: NodeType): boolean {
  return nodeType === NodeType.LINE
}

export function isPolygon(nodeType: NodeType): boolean {
  return nodeType === NodeType.POLYGON
}

export function isStar(nodeType: NodeType): boolean {
  return nodeType === NodeType.STAR
}
