import type { IRenderBackend } from './contract/renderBackend'
import type { NodeCursor } from '@latte-js/espresso'
export interface INodeRenderer {
  render(backend: IRenderBackend, cursor: NodeCursor): void
}
