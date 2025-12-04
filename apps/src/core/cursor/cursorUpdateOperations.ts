import type { DisplayObject } from 'Latte/core/elements/displayObject'
import { EditOperation } from 'Latte/core/model/modelChange'

export class CursorUpdateOperations {
  public static setFills(objects: DisplayObject[], fills?: Paint[]) {
    return objects.map(object =>
      EditOperation.update(object.getGuidKey(), {
        fillPaints: fills ?? [],
      })
    )
  }
}
