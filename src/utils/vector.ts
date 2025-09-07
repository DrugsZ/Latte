export const ARRAY_TYPE =
  typeof Float32Array !== 'undefined' ? Float32Array : Array

export namespace Vector {
  export const create = (x, y): vec2 => {
    const vector = new ARRAY_TYPE(2)
    vector[0] = x
    vector[1] = y
    return vector
  }

  export const clone = (vector: ReadonlyVec2, out?: vec2) => {
    if (out) {
      ;[out[0], out[1]] = [vector[0], vector[1]]
    } else {
      out = create(vector[0], vector[1])
    }
    return out
  }

  export const equals = (a: ReadonlyVec2, b: ReadonlyVec2) =>
    a[0] === b[0] && a[1] === b[1]

  export const subtract = (a: ReadonlyVec2, b: ReadonlyVec2, out?: vec2) => {
    out = out || create(0, 0)
    out[0] = a[0] - b[0]
    out[1] = a[1] - b[1]
    return out
  }

  export const dot = (a: ReadonlyVec2, b: ReadonlyVec2, out?: vec2) => {
    out = out || create(0, 0)
    out[0] = a[0] * b[0]
    out[1] = a[1] * b[1]
    return out
  }

  export const add = (a: ReadonlyVec2, b: ReadonlyVec2, out?: vec2) => {
    out = out || create(0, 0)
    out[0] = a[0] + b[0]
    out[1] = a[1] + b[1]
    return out
  }

  export const divide = (a: ReadonlyVec2, b: ReadonlyVec2, out?: vec2) => {
    out = out || create(0, 0)
    out[0] = a[0] / b[0]
    out[1] = a[1] / b[1]
    return out
  }

  export const dotProduct = (a: ReadonlyVec2, b: ReadonlyVec2) =>
    a[0] * b[0] + a[1] * b[1]

  export const crossProduct = (a: ReadonlyVec2, b: ReadonlyVec2) =>
    a[0] * b[0] - a[1] * b[1]

  export const magnitude = (vec: ReadonlyVec2) =>
    Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1])

  export const len = (vec: ReadonlyVec2) =>
    Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1])

  export const edge = (vec: ReadonlyVec2) => create(-vec[1], vec[0])

  export const normal = (vec: ReadonlyVec2) => {
    const v = new ARRAY_TYPE(2)
    const m = len(vec)
    if (m !== 0) {
      v[0] = vec[0] / m
      v[1] = vec[1] / m
    }
    return v
  }

  export function point2Vec2<T extends IPoint | undefined | null>(
    point: T,
    out?: vec2
  ): T extends IPoint ? vec2 : undefined
  export function point2Vec2(
    point: IPoint | undefined | null,
    out?: vec2
  ): vec2 | undefined {
    if (!point) {
      return undefined
    }
    out = out || create(0, 0)
    out[0] = point.x
    out[1] = point.y
    return out
  }
}
