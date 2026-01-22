import type { INodeRenderer } from '../typing'
export const RectRenderer: INodeRenderer = {
  render(backend, cursor) {
    backend.drawRect(0, 0, cursor.width, cursor.height, 0, 0xffffffff)
  },
}
