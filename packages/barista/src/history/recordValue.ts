const errorPrefix = '[MutationRecordApplier]'

export const asNumber = (value: unknown): number => {
  if (typeof value !== 'number') {
    throw new Error(`${errorPrefix} Expected number, got ${value}`)
  }
  return value
}

export const asString = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new Error(`${errorPrefix} Expected string, got ${value}`)
  }
  return value
}

export const asBoolean = (value: unknown): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`${errorPrefix} Expected boolean, got ${value}`)
  }
  return value
}

export const asArray = <T = any>(value: unknown): T[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${errorPrefix} Expected array`)
  }
  return value as T[]
}

export const asMatrix = (
  value: unknown
): [number, number, number, number, number, number] => {
  const matrix = asArray<number>(value)
  if (matrix.length !== 6) {
    throw new Error(`${errorPrefix} Expected 2D matrix with 6 values`)
  }
  return matrix as [number, number, number, number, number, number]
}

export const asCornerRadius = (
  value: unknown
): [number, number, number, number] => {
  const radius = asArray<number>(value)
  if (radius.length !== 4) {
    throw new Error(`${errorPrefix} Expected corner radius with 4 values`)
  }
  return radius as [number, number, number, number]
}
