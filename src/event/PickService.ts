import { Point } from 'Latte/math/Point'
import { IEventTarget } from 'Latte/core/interfaces'
import type Page from 'Latte/core/page'

export interface IPickerService {
  pick(point: Point): IEventTarget | null
}

export class PickService implements IPickerService {
  constructor(private readonly _focusPageInstance: Page) {
    this.pick = this.pick.bind(this)
  }

  pick(point: Point): IEventTarget | null {
    return this._focusPageInstance.getChildren()[0]
  }
}
