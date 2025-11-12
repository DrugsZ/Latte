import { MoveElementTo, SetElementFills } from 'Latte/core/command/coreCommands'
import { Container } from 'Latte/core/elements/container'
import type { DisplayObject } from 'Latte/core/elements/displayObject'
import type { ActiveSelection } from 'Latte/core/selection/activeSelection'
import { MouseControllerTarget } from 'Latte/core/selection/activeSelection'
import type { ViewModel } from 'Latte/core/viweModel/viewModel'
import { Emitter } from 'Latte/utils/event'
import {
  FillType,
  StrokeJoin,
  BlendModeType,
  EditorElementTypeKind,
} from 'Latte/constants/schema'

const ProxyProp = ['x', 'y', 'width', 'height']
const ProxyWidget = (target: ActiveSelectionWidget) =>
  new Proxy(target, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && ProxyProp.includes(prop)) {
        const objects = target.getObjects()
        return objects.reduce(
          (pre: number | string, cur) => (cur.x === pre ? pre : 'MIXED'),
          objects[0].x
        )
      }
      if (prop in target) {
        return Reflect.get(target, prop, receiver)
      }
      return Reflect.get(target, prop, receiver)
    },
  })

function ProxyActiveSelectionWidget(target: typeof ActiveSelectionWidget) {
  const p = new Proxy(target, {
    construct(
      Target,
      argArray: ConstructorParameters<typeof ActiveSelectionWidget>
    ) {
      return ProxyWidget(new Target(...argArray))
    },
  })
}

@ProxyActiveSelectionWidget
export class ActiveSelectionWidget {
  private readonly _onDidSelectionChange = new Emitter<ActiveSelection>()
  public readonly onDidSelectionChange = this._onDidSelectionChange.event

  constructor(
    private _viewModel: ViewModel,
    private _activeSelection: ActiveSelection
  ) {}

  move(newPosition: latte.editor.SetStateAction<ReadonlyVec2>) {
    const objects = this._activeSelection.getObjects()

    MoveElementTo.runCoreEditorCommand(this._viewModel, {
      position: newPosition,
      objects,
    })
  }

  setFills(fills: Paint[]) {
    const objects = this._activeSelection.getObjects()
    SetElementFills.runCoreEditorCommand(this._viewModel, {
      newFills: fills,
      objects,
    })
  }

  getObjects() {
    return this._activeSelection.getObjects()
  }
}

export class ActiveSelectionCollection extends Container {
  public readonly controllerType: MouseControllerTarget

  constructor() {
    super({
    super({
      type: EditorElementTypeKind.RECTANGLE,
      name: 'ActiveSelectionCollection',
      locked: false,
      visible: true,
      opacity: 1,
      size: {
        x: 0,
        y: 0,
      },
      fillPaints: [
        {
          type: FillType.SOLID,
          color: { r: 0, g: 0, b: 0, a: 0 },
          opacity: 1,
          visible: true,
          blendMode: BlendModeType.NORMAL,
        },
      ],
      strokePaints: [],
      strokeWeight: 0,
      strokeAlign: 'CENTER',
      strokeJoin: StrokeJoin.MITER,
      miterAngle: 10,
      strokeStyle: 'SOLID',
      dashCap: StrokeCap.BUTT,
      parentIndex: 0,
      guid: '',
      transform: {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        tx: 0,
        ty: 0,
      },
    })
  })

  public override appendChild(...child: DisplayObject[]) {
    child.forEach(element => {
      this._appendChild(element)
    })
  }
}
