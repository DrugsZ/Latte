export function illegalArgument(name?: string): Error {
  if (name) {
    return new Error(`Illegal argument: ${name}`)
  }
  return new Error('Illegal argument')
}

export function unknownType(type: never): never {
  throw new Error('is unknown')
}
