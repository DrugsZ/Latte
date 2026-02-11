import type { IEventTarget } from 'Latte/core/dom/interfaces'
import { DisplayObject } from 'Latte/core/elements/displayObject'
import type Ellipse from 'Latte/core/elements/ellipse'
import type Rect from 'Latte/core/elements/rect'

export function isFunction(func: any): func is (...args: any[]) => any {
  return typeof func === 'function'
}

export const isObject = <T = object>(value: any): value is T => {
  const type = typeof value
  return (value !== null && type === 'object') || type === 'function'
}

export const isBoolean = (value): boolean => typeof value === 'boolean'

export const isDisplayObject = (
  node: IEventTarget | DisplayObject
): node is DisplayObject => node instanceof DisplayObject

export const isRect = (node: IEventTarget | DisplayObject): node is Rect =>
  node instanceof DisplayObject && node.type === 'RECTANGLE'

export const isEllipse = (
  node: IEventTarget | DisplayObject
): node is Ellipse => node instanceof DisplayObject && node.type === 'ELLIPSE'
