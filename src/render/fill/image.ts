import type { FillType } from 'Latte/constants/schema'
import type {
  IEditorFillRenderContributionDescription,
  FillRenderOptions,
} from 'Latte/render/renderContributionRegistry'
import { textureManager } from 'Latte/core/texture'
import { Vector } from 'Latte/common/vector'

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
    imageSize: vec2,
    boxSize: vec2,
    fillType: ImageFillScaleMode.FILL | ImageFillScaleMode.FIT
  ) {
    const ratio = Vector.divide(boxSize, imageSize)
    let [x, y] = ratio
    if (y < x) {
      if (fillType === ImageFillScaleMode.FILL) {
        y = x
      } else {
        x = y
      }
    } else if (fillType === ImageFillScaleMode.FILL) {
      x = y
    } else {
      y = x
    }
    const renderSize = Vector.dot(ratio, imageSize)
    const client = Vector.divide(Vector.subtract(boxSize, renderSize), [2, 2])
    return {
      dx: client[0],
      dy: client[1],
      dWidth: renderSize[0],
      dHeight: renderSize[1],
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
      Vector.create(width, height),
      Vector.create(size.width, size.height),
      imageScaleMode
    )
    ctx.drawImage(imgBitMap, dx, dy, dWidth, dHeight)
  }
}
