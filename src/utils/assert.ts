import type { IEventTarget } from 'Latte/core/interfaces'
import { DisplayObject } from 'Latte/core/DisplayObject'
import type Ellipse from 'Latte/elements/Ellipse'
import type Rect from 'Latte/elements/Rect'

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
): node is DisplayObject => {
  return node instanceof DisplayObject
}

export const isRect = (node: IEventTarget | DisplayObject): node is Rect => {
  return node instanceof DisplayObject && node.type === 'RECTANGLE'
}

export const isEllipse = (
  node: IEventTarget | DisplayObject
): node is Ellipse => {
  return node instanceof DisplayObject && node.type === 'ELLIPSE'
}
