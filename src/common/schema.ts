import dayjs from 'dayjs'

let uuid = 0
export const getUUId = () => `${dayjs().format()}_${++uuid}`

export const isRect = (type: ElementType) => type === 'RECTANGLE'

export const createDefaultElement = (): CditorElement => ({
    id: getUUId(),
    type: 'RECTANGLE',
    name: '',
    hidden: false,
    locked: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    relativeTransform: [1, 0, 0, 1, 0, 0],
    absoluteTransform: [1, 0, 0, 1, 0, 0],
    opacity: 1,
    fills: [],
})

export const createPageModel = () =>
    ({
        id: getUUId(),
        type: 'PAGE',
        name: '',
        children: [] as CditorElement[],
    } as PAGE)

export const createDefaultDocument = (): CditorDocument => ({
    id: getUUId(),
    type: 'DOCUMENT',
    name: '',
    children: [createPageModel()],
})

export const createElement = () => {
    const defaultElement = createDefaultElement()
    return defaultElement
}
