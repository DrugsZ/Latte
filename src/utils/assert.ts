export function isFunction(func: any): func is (...args: any[]) => any {
  return typeof func === 'function'
}

export const isObject = <T = object>(value: any): value is T => {
  const type = typeof value
  return (value !== null && type === 'object') || type === 'function'
}

export const isBoolean = (value): boolean => typeof value === 'boolean'
