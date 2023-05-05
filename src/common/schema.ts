let uuid = 0
export const getUUId = () => ({
  sessionID: 1,
  localID: ++uuid,
})

export const isRect = (type: ElementType) => type === 'RECTANGLE'

export const createDefaultElement = (parentInfo: {
  guid: string
  position: number
}): BaseNodeSchema => ({
  guid: getUUId(),
  type: 'RECTANGLE',
  name: '',
  visible: true,
  locked: false,
  parentInfo,
  size: {
    x: 0,
    y: 0,
  },
  transform: {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    tx: 0,
    ty: 0,
  },
  opacity: 1,
  fills: [],
})

export const createPageModel = createDefaultElement

export const createDefaultDocument = (): CditorFile => ({
  elements: [],
  sessionID: 1,
})

export const createElement = () => {
  const defaultElement = createDefaultElement()
  return defaultElement
}
