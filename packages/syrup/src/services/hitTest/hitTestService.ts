import { createDecorator } from '../instantiation/instantiation'

import type { HitResult } from '@latte-js/bean'
import type { IPoint } from '@latte-js/kit'

export interface IHitTestResult {
  readonly hitResult: HitResult | undefined
  readonly viewport: IPoint
  readonly world: IPoint
}

export interface IHitTestService {
  hitTest(clientX: number, clientY: number): IHitTestResult
}

export const IHitTestService =
  createDecorator<IHitTestService>('hitTestService')

export class NullHitTestService implements IHitTestService {
  hitTest(clientX: number, clientY: number): IHitTestResult {
    const point = { x: clientX, y: clientY }
    return {
      hitResult: undefined,
      viewport: point,
      world: point,
    }
  }
}
