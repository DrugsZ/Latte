import type { Camera } from 'Latte/core/cameraService'
import type * as viewEvents from 'Latte/view/viewEvents'
import { ViewPart } from 'Latte/view/viewPart'

export class ViewGrid extends ViewPart {
  public override onCameraChange(
    event: viewEvents.ViewCameraUpdateEvent
  ): boolean {
    const zoom = event.camera.getZoom()

    return zoom >= 8
  }
  private _renderGrid(ctx: CanvasRenderingContext2D, camera: Camera) {
    const zoom = camera.getZoom()
    if (zoom < 8) {
      return
    }
    const { a, b, c, d, tx, ty } = camera.getViewPortMatrix()
    ctx.setTransform(a, b, c, d, tx, ty)
    const { x: viewPortX, y: viewPortY, width, height } = camera.getViewport()
    let startX = Math.ceil(viewPortX)
    const endX = viewPortX + width
    let startY = Math.ceil(viewPortY)
    const endY = viewPortY + height
    ctx.lineWidth = 1 / zoom
    while (startX <= endX) {
      ctx.strokeStyle = '#cccccc55'
      ctx.beginPath()
      ctx.moveTo(startX, viewPortY)
      ctx.lineTo(startX, height)
      ctx.stroke()
      ctx.closePath()
      startX += 1
    }
    while (startY <= endY) {
      ctx.strokeStyle = '#cccccc55'
      ctx.beginPath()
      ctx.moveTo(viewPortX, startY)
      ctx.lineTo(width, startY)
      ctx.stroke()
      ctx.closePath()
      startY += 1
    }
    ctx.save()
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    this._renderGrid(ctx, camera)
  }
}
