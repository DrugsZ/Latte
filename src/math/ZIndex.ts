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
      continue
    }
    const aNumber = a.charCodeAt(i)
    const bNumber = b.charCodeAt(i)
    return aNumber >= bNumber
  }
}
