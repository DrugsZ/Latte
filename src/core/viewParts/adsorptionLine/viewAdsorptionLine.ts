import { Vector } from 'Latte/utils/vector'
import type { Camera } from 'Latte/core/services/camera/cameraService'
import { ViewPart } from 'Latte/core/viewParts/base/viewPart'
import type { ViewCursorStateChangeEvent } from 'Latte/core/viewParts/base/viewEvents'

export const drawLine = (ctx: CanvasRenderingContext2D, paths: vec2[]) => {
  if (paths.length <= 1) {
    return
  }
  ctx.beginPath()
  const start = paths[0]
  ctx.moveTo(start[0], start[1])
  for (let i = 1; i < paths.length; i++) {
    const path = paths[i]
    ctx.lineTo(path[0], path[1])
  }
  ctx.closePath()
  ctx.stroke()
}

export const drawXShape = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
) => {
  const tl = [cx - size / 2, cy - size / 2]
  const tr = [cx + size / 2, cy - size / 2]
  const bl = [cx - size / 2, cy + size / 2]
  const br = [cx + size / 2, cy + size / 2]

  drawLine(ctx, [tl, br])
  drawLine(ctx, [tr, bl])
}

const expandAbsorbToXPoint = (arr: number[]) => {
  const main = arr[0]
  const result: vec2[] = []
  for (let i = 1; i < arr.length; i++) {
    result.push(Vector.create(main, arr[i]))
  }
  return result
}

const expandAbsorbToYPoint = (arr: number[]) => {
  const main = arr[0]
  const result: vec2[] = []
  for (let i = 1; i < arr.length; i++) {
    result.push(Vector.create(arr[i], main))
  }
  return result
}
interface IAbsorbPoint {
  x: number[]
  y: number[]
}

export class ViewAdsorptionLine extends ViewPart {
  private _adsorptionPoints: IAbsorbPoint = {
    x: [],
    y: [],
  }

  public override onCursorStateChange(
    event: ViewCursorStateChangeEvent
  ): boolean {
    const { adsorptionPoints } = event.state
    this._adsorptionPoints = adsorptionPoints
    return true
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const renderPoints = this._adsorptionPoints
    if (renderPoints.x.length < 1 && renderPoints.y.length < 1) {
      return
    }
    const { a, b, c, d, tx, ty } = camera.getViewPortMatrix()
    ctx.setTransform(a, b, c, d, tx, ty)
    ctx.lineWidth = 2
    ctx.strokeStyle = 'red'
    const { x, y } = renderPoints
    const xPoints = expandAbsorbToXPoint(x)
    const yPoints = expandAbsorbToYPoint(y)

    if (xPoints.length) {
      for (let i = 0; i < xPoints.length; i++) {
        const x = xPoints[i]
        drawXShape(ctx, x[0], x[1], 4)
      }
      drawLine(ctx, xPoints)
    }
    if (yPoints.length) {
      for (let i = 0; i < yPoints.length; i++) {
        const y = yPoints[i]
        drawXShape(ctx, y[0], y[1], 4)
      }
      drawLine(ctx, yPoints)
    }
  }
}
