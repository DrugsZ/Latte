type ElementType =
    | 'FRAME'
    | 'TEXT'
    | 'GROUP'
    | 'RECTANGLE'
    | 'Vector'
    | 'LINE'
    | 'ARROW'
    | 'ELLIPSE'
    | 'POLYGON'
    | 'STAR'

interface BaseFill {
    type: string
    visible: boolean
    opacity: number
}

interface SolidColorFill extends BaseFill {
    type: 'SOLID'
    color: {
        r: number
        g: number
        b: number
    }
}

type Fill = SolidColorFill

type Transform = [[number, number, number], [number, number, number]]

interface BaseNode {
    id: string
    type: string
    name: string
}

interface CditorDocument extends BaseNode {
    type: 'DOCUMENT'
    children: PAGE[]
}

interface PAGE extends BaseNode {
    type: 'PAGE'
    backgrounds: Fill[]
    children: CditorElement[]
}

interface CditorElement extends BaseNode {
    type: ElementType
    hidden: boolean
    locked: boolean
    x: number
    y: number
    width: number
    height: number
    relativeTransform: Transform
    absoluteTransform?: Transform
    opacity: number
    fills: Fill[]
}

interface RectangleElement extends Element {
    type: 'RECTANGLE'
    radius: [number, number, number, number]
}

interface Window {
    test: any
}
