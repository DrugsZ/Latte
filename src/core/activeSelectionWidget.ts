import { Emitter } from 'Latte/common/event'
import type { ActiveSelection } from 'Latte/core/activeSelection'
import { isFunction } from 'Latte/utils/assert'
import { CoreEditingCommands } from 'Latte/core/coreCommands'
import type { ViewModel } from 'Latte/core/viewModel'

const ProxyProp = ['x', 'y', 'width', 'height']
const ProxyWidget = (target: BaseActiveSelectionWidget) =>
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

function ProxyActiveSelectionWidget(target: typeof BaseActiveSelectionWidget) {
  const p = new Proxy(target, {
    construct(
      Target,
      argArray: ConstructorParameters<typeof BaseActiveSelectionWidget>
    ) {
      console.log(1111)
      return ProxyWidget(new Target(...argArray))
    },
  })
}

@ProxyActiveSelectionWidget
export class BaseActiveSelectionWidget {
  private readonly _onDidSelectionChange = new Emitter<ActiveSelection>()
  public readonly onDidSelectionChange = this._onDidSelectionChange.event

  constructor(
    private _viewModel: ViewModel,
    private _activeSelection: ActiveSelection
  ) {}

  move(newPosition: latte.editor.SetStateAction<IPoint>) {
    const objects = this._activeSelection.getObjects()

    CoreEditingCommands.MoveElementTo.runCoreEditorCommand(this._viewModel, {
      position: newPosition,
      objects,
    })
  }

  getObjects() {
    return this._activeSelection.getObjects()
  }
}
