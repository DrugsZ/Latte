import { NodeType } from '@latte-js/bean'

import { EllipseRenderer, RectRenderer } from '../renderers'

import type { INodeRenderer } from '../typing'

export const renderers = new Array<INodeRenderer>(1 << 8)

export function registerRenderer(type: NodeType, renderer: INodeRenderer) {
  renderers[type] = renderer
}

export function getRenderer(type: NodeType) {
  return renderers[type]
}

registerRenderer(NodeType.RECTANGLE, RectRenderer)
registerRenderer(NodeType.ELLIPSE, EllipseRenderer)
