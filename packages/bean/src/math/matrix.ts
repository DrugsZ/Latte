export type Matrix = [number, number, number, number, number, number]

interface IndexedCollection extends Iterable<number> {
  readonly length: number
  [index: number]: number
}

export type mat2d =
  | [number, number, number, number, number, number]
  | IndexedCollection

export type Point = {
  x: number
  y: number
}
