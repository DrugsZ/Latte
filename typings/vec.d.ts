interface IndexedCollection extends Iterable<number> {
  readonly length: number
  [index: number]: number
}

type ReadonlyVec2 = readonly [number, number] | IndexedCollection

type vec2 = [number, number] | IndexedCollection
