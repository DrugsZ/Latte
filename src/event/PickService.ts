import { Point } from 'Latte/math/Point'
import { IEventTarget } from 'Latte/core/interfaces'

export interface IPickerService {
  pick(point: Point): IEventTarget | null
}

export class PickService implements IPickerService {
  pick(point: Point): IEventTarget | null {
    return null
  }
}
