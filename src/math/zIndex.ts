const MIN_ASCII = '!'
const MAX_ASCII = '}'

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

export function decreaseOne(a: string) {
  if (a.length > 1) {
    const str = a.split('')
    str[str.length - 1] = decreaseOne(a.charAt(a.length - 1))
    return str.join('')
  }
  if (a === MIN_ASCII) {
    return ` }`
  }
  return String.fromCodePoint(a.charCodeAt(0) - 1)
}

export function plusOne(a: string) {
  if (a.length > 1) {
    const str = a.split('')
    str[str.length - 1] = plusOne(a.charAt(a.length - 1))
    return str.join('')
  }
  if (a === MAX_ASCII) {
    return `}!`
  }
  return String.fromCodePoint(a.charCodeAt(0) + 1)
}

// export function getNewASCIIByTowValue(value1: null, value2: string)
// export function getNewASCIIByTowValue(value1: string, value2: null)
// export function getNewASCIIByTowValue(value1: string, value2: string) {
//   if (!value1) {
//     return
//   }
//   if (!value2) {
//   }
// }
