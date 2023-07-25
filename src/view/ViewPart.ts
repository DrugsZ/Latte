import { ViewEventHandler } from 'Latte/view/viewEventHandler'
import type { Camera } from 'Latte/core/CameraService'

export abstract class ViewPart extends ViewEventHandler {
  public abstract render(ctx: CanvasRenderingContext2D, camera: Camera): void
}
