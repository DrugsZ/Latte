import type { NodeType } from '@latte-js/bean'
import type { INodeRenderer } from '../typing'

export const renderers = new Array<INodeRenderer>(1 << 8)

export function registerRenderer(type: NodeType, renderer: INodeRenderer) {
  renderers[type] = renderer
}

export function getRenderer(type: NodeType) {
  return renderers[type]
}
