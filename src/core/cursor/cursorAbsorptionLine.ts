import { Vector } from 'Latte/utils/vector'
import type { Cursor } from 'Latte/core/cursor/cursor'

const DEFAULT_ABSORB_SIZE = 10

// xMin, xMax, yMin, yMax, center]
export type ElementAdsorptionRecord = [
  ReadonlyVec2,
  ReadonlyVec2,
  ReadonlyVec2,
  ReadonlyVec2,
  ReadonlyVec2
]

export type AdsorptionLine = number[]

type CompareFn<T> = (a: T, b: T) => boolean

const partition = <T>(
  arr: T[],
  left: number,
  right: number,
  compare: CompareFn<T>
): number => {
  let leftLast = left
  const pivotValue = arr[left]
  for (let i = left + 1; i <= right; i++) {
    if (compare(arr[i], pivotValue)) {
      leftLast++
      ;[arr[i], arr[leftLast]] = [arr[leftLast], arr[i]]
    }
  }

  ;[arr[left], arr[leftLast]] = [arr[leftLast], arr[left]]

  return leftLast
}

function quickSort<T>(
  arr: T[],
  compare: CompareFn<T>,
  left = 0,
  right = arr.length - 1
) {
  if (left >= right) return
  const pivotIndex = partition(arr, left, right, compare)

  quickSort(arr, compare, left, pivotIndex - 1)

  quickSort(arr, compare, pivotIndex + 1, right)
  return arr
}

type GetCompareNum = (a: ReadonlyVec2) => number

function binarySearch<T extends Array<any>>(
  nums: T,
  target: number,
  getNumber: GetCompareNum,
  moveNumber: number
): (typeof nums)[number] {
  let result
  let diff = DEFAULT_ABSORB_SIZE
  for (let i = 0; i < nums.length; i++) {
    const curNumber = getNumber(nums[i])
    const moveSign = Math.sign(moveNumber)
    if (moveSign === 1 && curNumber < target) {
      continue
    }
    if (moveSign === -1 && curNumber > target) {
      continue
    }
    if (Math.abs(target - curNumber) < diff) {
      result = nums[i]
      diff = Math.abs(target - curNumber)
    }
  }
  return result
}

// function binarySearch<T extends Array<any>>(
//   nums: T,
//   target: number,
//   getNumber: GetCompareNum
// ): (typeof nums)[number] | undefined {
//   let left = 0
//   let right = nums.length - 1

//   while (left <= right) {
//     const mid = Math.floor((left + right) / 2)
//     const midNumber = getNumber(nums[mid])

//     if (midNumber === target) {
//       return nums[mid]
//     }
//     if (midNumber < target) {
//       left = mid + 1
//     } else {
//       right = mid - 1
//     }
//   }

//   if (left >= nums.length) {
//     return nums[nums.length - 1]
//   }
//   if (right < 0) {
//     return nums[0]
//   }

//   const leftNumber = getNumber(nums[left])
//   const rightNumber = getNumber(nums[right])

//   return Math.abs(leftNumber - target) < Math.abs(rightNumber - target)
//     ? nums[left]
//     : nums[right]
// }

export class OtherElementAbsorptionVectorMap {
  private _xAxisArr: AdsorptionLine[] = []
  private _yAxisArr: AdsorptionLine[] = []

  private _centerMap: Map<ReadonlyVec2, ReadonlyVec2[]> = new Map()
  private _hasCache = false

  private _xMap: Map<number, AdsorptionLine> = new Map()
  private _yMap: Map<number, AdsorptionLine> = new Map()

  private _getOtherCenter(vec: ElementAdsorptionRecord) {
    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    const center = vec[vec.length - 1]
    for (const item of vec) {
      minX = Math.min(minX, item[0])
      maxX = Math.max(maxX, item[0])
      minY = Math.min(minY, item[1])
      maxY = Math.max(maxY, item[1])
    }
    const [centerX, centerY] = center
    return [
      [minX, centerY],
      [maxX, centerY],
      [centerX, minY],
      [centerX, maxY],
    ]
  }

  private _buildMap(vecs: ElementAdsorptionRecord[]) {
    for (const vec of vecs) {
      for (const v of vec.concat(this._getOtherCenter(vec))) {
        const [x, y] = v
        const xAxis = this._xMap.get(x)
        if (xAxis) {
          xAxis.push(y)
        } else {
          this._xMap.set(x, [x, y])
        }

        const yAxis = this._yMap.get(y)
        if (yAxis) {
          yAxis.unshift(x)
        } else {
          this._yMap.set(y, [x, y])
        }
      }
    }
  }

  private _reBuildHashMap() {
    this._xAxisArr = Array.from(this._xMap.values())
    this._yAxisArr = Array.from(this._yMap.values())
  }

  public buildCache(vecs: ElementAdsorptionRecord[]) {
    if (this._hasCache) {
      return
    }
    this._xMap.clear()
    this._yMap.clear()
    this._buildMap(vecs)
    this._reBuildHashMap()
    this._sortData()
    this._hasCache = true
  }

  public clearCache() {
    this._hasCache = false
    this._xAxisArr = []
    this._yAxisArr = []
    this._centerMap.clear()
    this._xMap.clear()
    this._yMap.clear()
  }

  private _sortData() {
    this._xAxisArr = quickSort<AdsorptionLine>(
      this._xAxisArr,
      (a, b) => a[0] < b[0]
    ) as AdsorptionLine[]
    this._yAxisArr = quickSort<AdsorptionLine>(
      this._yAxisArr,
      (a, b) => a[a.length - 1] < b[b.length - 1]
    ) as AdsorptionLine[]
  }

  public getSortedData() {
    return {
      x: this._xAxisArr,
      y: this._yAxisArr,
    }
  }
}

export class AdsorptionPointsResolver {
  private _cacheMap: OtherElementAbsorptionVectorMap

  private _getClosedVec(
    points: AdsorptionLine[],
    vec: number,
    movement: number,
    getNumber: GetCompareNum
  ) {
    return binarySearch<AdsorptionLine[]>(points, vec, getNumber, movement)
  }

  public resolve(
    cacheMap: OtherElementAbsorptionVectorMap,
    vec,
    movement: ReadonlyVec2
  ) {
    this._cacheMap = cacheMap
    const { x: xPoints, y: yPoints } = this._cacheMap.getSortedData()
    const x = this._getClosedVec(xPoints, vec[0], movement[0], a => a[0])
    const y = this._getClosedVec(
      yPoints,
      vec[1],
      movement[1],
      a => a[a.length - 1]
    )
    return {
      x,
      y,
    }
  }
}

interface AbsorptionResult {
  x: number[]
  y: number[]
  diff: vec2
}

export class AdsorptionResolver {
  private _cacheMap: OtherElementAbsorptionVectorMap =
    new OtherElementAbsorptionVectorMap()
  private _adsorptionPointsResolver: AdsorptionPointsResolver =
    new AdsorptionPointsResolver()

  private _afterAbsorbMovement: vec2 = Vector.create(0, 0)

  constructor(private _cursor: Cursor) {}

  private _tryOnePointAbsorption = (
    vec: vec2,
    movement: ReadonlyVec2
  ): AbsorptionResult => {
    const { x, y } = this._adsorptionPointsResolver.resolve(
      this._cacheMap,
      vec,
      movement
    )
    let absorptionXPoints: number[] = []
    let absorptionYPoints: number[] = []
    let absorptionDiffX = Number.POSITIVE_INFINITY
    let absorptionDiffY = Number.POSITIVE_INFINITY
    if (x?.length) {
      const diff = Math.abs(x[0] - vec[0])
      if (Math.abs(absorptionDiffX) >= diff) {
        absorptionDiffX = x[0] - vec[0]
        absorptionXPoints = [...x, vec[1]]
      }
    }
    if (y?.length) {
      const diff = Math.abs(y[y.length - 1] - vec[1])
      if (Math.abs(absorptionDiffY) >= diff) {
        absorptionDiffY = y[y.length - 1] - vec[1]
        absorptionYPoints = [vec[0], ...y]
      }
    }
    return {
      x: absorptionXPoints,
      y: absorptionYPoints,
      diff: Vector.create(absorptionDiffX, absorptionDiffY),
    }
  }

  private _getCloseInfo(data: AbsorptionResult[]): AbsorptionResult {
    let [diffX, diffY] = Vector.create(
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY
    )
    const result: AbsorptionResult = { x: [], y: [], diff: [diffX, diffY] }

    for (const item of data) {
      if (diffX >= item.diff[0]) {
        ;[diffX, result.x] = [item.diff[0], item.x]
      }
      if (diffY >= item.diff[1]) {
        ;[diffY, result.y] = [item.diff[1], item.y]
      }
    }
    if (!result.x.length) {
      diffX = 0
    }
    if (!result.y.length) {
      diffY = 0
    }

    return {
      ...result,
      diff: [diffX, diffY],
    }
  }

  private _cacheAbsorbPoints = {
    x: new Set(),
    y: new Set(),
  }

  private _preAbsorbPoints = Vector.create(Number.NaN, Number.NaN)
  private _curAbsorbPoints = Vector.create(0, 0)

  private _absorbStatus = {
    x: false,
    y: false,
  }
  private _accumulator: vec2 = Vector.create(0, 0)

  private _addMovementToAccumulator(movement: vec2) {
    if (this._absorbStatus.x) {
      this._accumulator[0] += movement[0]
    } else {
      this._accumulator[0] = 0
    }
    if (this._absorbStatus.y) {
      this._accumulator[1] += movement[1]
    } else {
      this._accumulator[1] = 0
    }
  }
  private _checkAbsorbStatus(absorptionPoints: { x: number[]; y: number[] }) {
    if (absorptionPoints.x.length > 0) {
      this._absorbStatus.x = true
    } else {
      this._absorbStatus.x = false
    }
    if (absorptionPoints.y.length > 0) {
      this._absorbStatus.y = true
    } else {
      this._absorbStatus.y = false
    }
  }

  private _comparePreAndCurX(diffValue: number) {
    if (!this._absorbStatus.x) {
      return
    }
    if (this._preAbsorbPoints[0] !== this._curAbsorbPoints[0]) {
      ;[this._preAbsorbPoints[0]] = this._curAbsorbPoints
      this._accumulator[0] = 0
      this._afterAbsorbMovement[0] = diffValue
    } else if (Math.abs(this._accumulator[0]) >= DEFAULT_ABSORB_SIZE) {
      this._afterAbsorbMovement[0] =
        DEFAULT_ABSORB_SIZE * Math.sign(this._afterAbsorbMovement[0])
      this._preAbsorbPoints[0] = Number.NaN
    } else {
      this._afterAbsorbMovement[0] = 0
    }
  }

  private _comparePreAndCurY(diffValue) {
    if (!this._absorbStatus.y) {
      return
    }

    if (this._preAbsorbPoints[1] !== this._curAbsorbPoints[1]) {
      ;[, this._preAbsorbPoints[1]] = this._curAbsorbPoints
      this._accumulator[1] = 0
      this._afterAbsorbMovement[1] = diffValue
    } else if (Math.abs(this._accumulator[1]) >= DEFAULT_ABSORB_SIZE) {
      this._afterAbsorbMovement[1] =
        DEFAULT_ABSORB_SIZE * Math.sign(this._afterAbsorbMovement[1])
      this._preAbsorbPoints[1] = Number.NaN
    } else {
      this._afterAbsorbMovement[1] = 0
    }
  }

  private _comparePreAndCurPoint(diff: vec2) {
    this._comparePreAndCurX(diff[0])
    this._comparePreAndCurY(diff[1])
  }

  private _onElementWillMove(
    vecs: ElementAdsorptionRecord[],
    curs: ReadonlyVec2[],
    movement: ReadonlyVec2
  ) {
    this._cacheMap.buildCache(vecs)
    const results = curs.map((cur, index) => ({
      ...this._tryOnePointAbsorption(cur, movement),
      index,
    }))
    const { diff, x, y } = this._getCloseInfo(results)
    ;[this._curAbsorbPoints[0]] = x
    this._curAbsorbPoints[1] = y[y.length - 1]
    const adsorptionPoints = {
      x,
      y,
    }
    this._checkAbsorbStatus(adsorptionPoints)
    this._comparePreAndCurPoint(diff)
    this._cursor.setState({
      adsorptionPoints,
    })
    return this._afterAbsorbMovement
  }

  public onElementWillMove(
    vecs: ElementAdsorptionRecord[],
    curs: ReadonlyVec2[],
    movement: ReadonlyVec2
  ) {
    this._addMovementToAccumulator(movement)
    Vector.clone(movement, this._afterAbsorbMovement)
    return this._onElementWillMove(vecs, curs, movement)
  }

  private _clearCachePoints() {
    this._cacheAbsorbPoints.x.clear()
    this._cacheAbsorbPoints.y.clear()
  }

  public onElementMoveEnd(curs: ReadonlyVec2[]) {
    this._cacheMap.clearCache()
    this._clearCachePoints()
    this._cursor.setState({
      adsorptionPoints: {
        x: [],
        y: [],
      },
    })
  }

  public onElementDidMove(curs: ReadonlyVec2[]) {}
}
