import type { INodeRenderer } from '../typing'
export const EllipseRenderer: INodeRenderer = {
  render(backend, cursor) {
    const { width, height } = cursor
    const radiusX = width / 2
    const radiusY = height / 2
    backend.drawEllipse(radiusX, radiusY, width, height, 0, 0xffffffff)
  },
}
