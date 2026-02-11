const BASE_ASCII_NUMBER = 100
const START_ASCII_NUMBER = 32

export const compareASCII = (a: string, b: string) => {
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i++) {
    if (!a[i]) {
      return false
    }
    if (!b[i]) {
      return true
    }
    if (a[i] === b[i]) {
      // eslint-disable-next-line no-continue
      continue
    }
    const aNumber = a.charCodeAt(i)
    const bNumber = b.charCodeAt(i)
    return aNumber >= bNumber
  }
  return false
}

function ASCII2Numbers(str: string) {
  return str
    .split('')
    .map(s => (s.codePointAt(0) as number) - START_ASCII_NUMBER)
}

function numbers2ASCII(nums: number[]) {
  return nums.map(n => String.fromCodePoint(n + START_ASCII_NUMBER)).join('')
}

export function numberOrASCIIPlus(arr: number[] | string, n = 1) {
  const result = Array.isArray(arr) ? arr : ASCII2Numbers(arr)
  let prev = n
  for (let i = result.length - 1; i >= 0; i--) {
    const cur = result[i] || 0
    if (prev + cur > BASE_ASCII_NUMBER) {
      result[i] = prev + cur - BASE_ASCII_NUMBER
      prev = 1
    } else {
      result[i] = prev + cur
      prev = 0
    }
  }
  if (result[0] > BASE_ASCII_NUMBER) {
    result[0] -= BASE_ASCII_NUMBER
    result.unshift(1)
  }
  return numbers2ASCII(result)
}

const decrease = (value1: number[], value2: number[]) => {
  const length = Math.max(value1.length, value2.length)
  let prev = 0
  const result: number[] = []
  for (let i = length - 1; i >= 0; i--) {
    let aNumber = (value1[i] || 0) + prev
    const bNumber = value2[i] || 0
    prev = 0
    if (aNumber < bNumber) {
      if (aNumber[i - 1]) {
        aNumber += BASE_ASCII_NUMBER
        prev -= 1
      }
    }
    result.unshift(aNumber - bNumber)
  }
  return result.reduce((pre, cur) => pre * BASE_ASCII_NUMBER + cur, 0)
}

export function getNewASCIIInSpace(
  value1: number[] | string,
  value2: number[] | string
) {
  const curValue1 = Array.isArray(value1) ? value1 : ASCII2Numbers(value1)
  const curValue2 = Array.isArray(value2) ? value2 : ASCII2Numbers(value2)
  const diff = decrease(curValue1, curValue2)
  const baseArr: number[] = new Array(
    Math.max(curValue1.length, curValue2.length)
  ).fill(0)
  const useArr = diff < 0 ? curValue1 : curValue2
  baseArr.splice(0, useArr.length, ...useArr)
  return numberOrASCIIPlus([...baseArr], Math.floor(Math.abs(diff) / 2))
}

export const calcPosition = (startPosition?: string, endPosition?: string) => {
  if (!startPosition) {
    return
  }
  if (endPosition) {
    return getNewASCIIInSpace(startPosition, endPosition)
  }
  return numberOrASCIIPlus(startPosition)
}
