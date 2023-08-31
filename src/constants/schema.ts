export enum EditorElementTypeKind {
  RECTANGLE = 'RECTANGLE',
  ELLIPSE = 'ELLIPSE',
  FRAME = 'FRAME',
  PAGE = 'CANVAS',
  DOCUMENT = 'DOCUMENT',
}

export enum FillType {
  SOLID = 'SOLID',
  GRADIENT_LINEAR = 'GRADIENT_LINEAR',
  GRADIENT_RADIAL = 'GRADIENT_RADIAL',
  GRADIENT_ANGULAR = 'GRADIENT_ANGULAR',
  GRADIENT_DIAMOND = 'GRADIENT_DIAMOND',
  IMAGE = 'IMAGE',
}

export enum BlendModeType {
  NORMAL = 'NORMAL',
  DARKEN = 'DARKEN',
  MULTIPLY = 'MULTIPLY',
  COLOR_BURN = 'COLOR_BURN',
  LIGHTEN = 'LIGHTEN',
  SCREEN = 'SCREEN',
  COLOR_DODGE = 'COLOR_DODGE',
  OVERLAY = 'OVERLAY',
  SOFT_LIGHT = 'SOFT_LIGHT',
  HARD_LIGHT = 'HARD_LIGHT',
  DIFFERENCE = 'DIFFERENCE',
  EXCLUSION = 'EXCLUSION',
  HUE = 'HUE',
  SATURATION = 'SATURATION',
  COLOR = 'COLOR',
  LUMINOSITY = 'LUMINOSITY',
}

export const DEFAULT_LATTE_FILE: LatteFile = {
  type: 'NODE_CHANGES',
  sessionID: 0,
  guid: {
    sessionID: 0,
    localID: -1,
  },
  elements: [],
}

export const DEFAULT_DOCUMENT_SCHEMA: LatteDocument = {
  guid: {
    sessionID: 0,
    localID: 0,
  },
  type: EditorElementTypeKind.DOCUMENT,
  name: 'Document',
  visible: true,
  opacity: 1,
  transform: {
    a: 1,
    b: 0,
    tx: 0,
    c: 0,
    d: 1,
    ty: 0,
  },
}

export const DEFAULT_PAGE_SCHEMA: PAGE = {
  guid: {
    sessionID: 0,
    localID: 1,
  },
  parentIndex: {
    guid: {
      sessionID: 0,
      localID: 0,
    },
    position: '!',
  },
  type: EditorElementTypeKind.PAGE,
  name: 'Page 1',
  visible: true,
  opacity: 1,
  transform: {
    a: 1,
    b: 0,
    tx: 0,
    c: 0,
    d: 1,
    ty: 0,
  },
  backgrounds: [
    {
      type: FillType.SOLID,
      color: {
        r: 0.11764705926179886,
        g: 0.11764705926179886,
        b: 0.11764705926179886,
        a: 1,
      },
      opacity: 1,
      visible: true,
      blendMode: BlendModeType.NORMAL,
    },
  ],
}

export const DEFAULT_RECTANGLE_SCHEMA: RectangleElement = {
  guid: {
    sessionID: 1,
    localID: 3,
  },
  parentIndex: {
    guid: {
      sessionID: 0,
      localID: 1,
    },
    position: '!',
  },
  type: EditorElementTypeKind.RECTANGLE,
  name: 'Rectangle 1',
  visible: true,
  locked: false,
  opacity: 1,
  size: {
    x: 100,
    y: 199,
  },
  transform: {
    a: 1,
    b: 0,
    tx: 0,
    c: 0,
    d: 1,
    ty: 0,
  },
  cornerRadius: 0,
  strokeWeight: 1,
  strokeAlign: 'INSIDE',
  strokeJoin: 'MITER',
  fillPaints: [
    {
      type: FillType.SOLID,
      color: {
        r: 0.8509804010391235,
        g: 0.8509804010391235,
        b: 0.8509804010391235,
        a: 1,
      },
      opacity: 1,
      visible: true,
      blendMode: BlendModeType.NORMAL,
    },
  ],
  strokePaints: [],
  topLeftRadius: 0,
  topRightRadius: 0,
  bottomLeftRadius: 0,
  bottomRightRadius: 0,
  strokeTopWeight: 1,
  strokeBottomWeight: 1,
  strokeLeftWeight: 1,
  strokeRightWeight: 1,
  cornerSmoothing: 1,
  strokeStyle: 'SOLID',
  dashCap: 'NONE',
  miterAngle: 1,
}
