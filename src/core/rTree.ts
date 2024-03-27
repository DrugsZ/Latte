import type { DisplayObject } from 'Latte/core/displayObject'

import RBush from 'rbush/index'

export interface RBushNodeAABB {
  displayObject: DisplayObject
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const rTreeRoot = new RBush<RBushNodeAABB>(16)
