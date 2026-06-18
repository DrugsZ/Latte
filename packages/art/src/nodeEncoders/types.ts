import type { IRenderCommandEncoder } from '../contract/renderBackend'
import type { NodeCursor } from '@latte-js/espresso'

export interface INodeCommandEncoder {
  encode(encoder: IRenderCommandEncoder, cursor: NodeCursor): void
}
