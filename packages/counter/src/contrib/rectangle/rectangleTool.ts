import {
  BlendModeType,
  FillType,
  NodeType,
  type IDType,
  type INodeService,
  type IMouseEvent,
} from '@latte-js/bean'

import type { SelectionService } from '../../services/selection/selectionService'
import type { PageService } from '../../services/page/pageService'

interface RectanglePointerEvent extends IMouseEvent {
  readonly world?: { readonly x: number; readonly y: number }
}

let nextRectangleId = 1

const createRectangleId = (): IDType =>
  `rectangle:${Date.now()}-${nextRectangleId++}` as IDType

export class RectangleTool {
  public readonly id = 'rectangle-tool'

  constructor(
    private readonly _nodeService: INodeService,
    private readonly _pageService: PageService,
    private readonly _selectionService: SelectionService
  ) {}

  public activate() {}

  public deactivate() {}

  public onPointerDown(event: IMouseEvent) {
    if (event.rightButton || event.middleButton) {
      return
    }
    const pointer = event as RectanglePointerEvent
    if (!pointer.world) {
      return
    }

    void this._createRectangle(pointer.world.x, pointer.world.y).catch(
      error => {
        console.error('[RectangleTool] Failed to create rectangle', error)
      }
    )
  }

  private async _createRectangle(x: number, y: number) {
    const parentId = await this._pageService.ensureActivePage()
    if (!parentId) {
      return
    }

    const id = createRectangleId()
    await this._nodeService.createNode({
      id,
      type: NodeType.RECTANGLE,
      parentId,
      name: 'Rectangle',
      fills: [
        {
          type: FillType.SOLID,
          visible: true,
          opacity: 1,
          blendMode: BlendModeType.NORMAL,
          color: { r: 0.75, g: 0.78, b: 0.84, a: 1 },
        },
      ],
      x,
      y,
      width: 100,
      height: 100,
    })
    this._selectionService.select([id])
  }
}
