import type { DisplayObject } from 'Latte/core/displayObject'
import { EditOperation } from 'Latte/core/modelChange'

export class CursorUpdateOperations {
  public static setFills(objects: DisplayObject[], fills?: Paint[]) {
    return objects.map(object =>
      EditOperation.update(object.getGuidKey(), {
        fillPaints: fills ?? [],
      })
    )
  }
}
