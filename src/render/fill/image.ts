import type { FillType } from 'Latte/constants/schema'
import type {
  IEditorFillRenderContributionDescription,
  FillRenderOptions,
} from 'Latte/render/renderContributionRegistry'
import { textureManager } from 'Latte/core/texture'
import { divide, dotProduct, subtract } from 'Latte/common/Point'

enum ImageFillScaleMode {
  FILL = 'FILL',
  FIT = 'FIT',
  CROP = 'CROP',
  TILE = 'TILE',
}

export class ImageFillRender
  implements IEditorFillRenderContributionDescription
{
  id: FillType.IMAGE
  // eslint-disable-next-line class-methods-use-this
  render = (
    fill: ImagePaint,
    ctx: CanvasRenderingContext2D,
    options?: FillRenderOptions
  ) => {
    const { image } = fill
    const { hash } = image
    const imgBitMap = textureManager.getTexture(hash)
    if (!imgBitMap || !options?.contextSize) {
      return
    }
    if (
      fill.imageScaleMode === ImageFillScaleMode.FILL ||
      fill.imageScaleMode === ImageFillScaleMode.FIT
    ) {
      this._renderFillImage(
        imgBitMap,
        options?.contextSize,
        ctx,
        fill.imageScaleMode
      )
    }
  }

  private _calcFillInfo(
    imageSize: IPoint,
    boxSize: IPoint,
    fillType: ImageFillScaleMode.FILL | ImageFillScaleMode.FIT
  ) {
    const ratio = divide(boxSize, imageSize)
    if (ratio.y < ratio.x) {
      if (fillType === ImageFillScaleMode.FILL) {
        ratio.y = ratio.x
      } else {
        ratio.x = ratio.y
      }
    } else if (fillType === ImageFillScaleMode.FILL) {
      ratio.x = ratio.y
    } else {
      ratio.y = ratio.x
    }
    const renderSize = dotProduct(ratio, imageSize)
    const client = divide(subtract(boxSize, renderSize), {
      x: 2,
      y: 2,
    })
    return {
      dx: client.x,
      dy: client.y,
      dWidth: renderSize.x,
      dHeight: renderSize.y,
    }
  }

  private _renderFillImage = (
    imgBitMap: ImageBitmap,
    size: FillRenderOptions['contextSize'],
    ctx: CanvasRenderingContext2D,
    imageScaleMode: ImageFillScaleMode.FILL | ImageFillScaleMode.FIT
  ) => {
    const { width, height } = imgBitMap
    const { dx, dy, dHeight, dWidth } = this._calcFillInfo(
      { x: width, y: height },
      { x: size.width, y: size.height },
      imageScaleMode
    )
    ctx.drawImage(imgBitMap, dx, dy, dWidth, dHeight)
  }
}
