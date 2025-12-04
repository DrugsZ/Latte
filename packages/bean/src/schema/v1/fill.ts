import { Matrix } from '../../math'
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

export interface IBaseFill {
  type: FillType
  visible: boolean
  opacity: number
  blendMode: BlendModeType
}

export interface FillColor {
  r: number
  g: number
  b: number
  a: number
}

export interface ISolidColorPaint extends IBaseFill {
  type: FillType.SOLID
  color: FillColor
}

export interface IFillColorStop {
  color: FillColor
  position: number
}

export interface IGradientLinearPaint extends IBaseFill {
  type: FillType.GRADIENT_LINEAR
  stops: [IFillColorStop, IFillColorStop]
  transform: Matrix
}

export interface IGradientRadialPaint extends IBaseFill {
  type: FillType.GRADIENT_RADIAL
  stops: [IFillColorStop, IFillColorStop]
  transform: Matrix
}

export interface IGradientAngularPaint extends IBaseFill {
  type: FillType.GRADIENT_ANGULAR
  stops: [IFillColorStop, IFillColorStop]
  transform: Matrix
}

export interface IGradientDiamondPaint extends IBaseFill {
  type: FillType.GRADIENT_DIAMOND
  stops: [IFillColorStop, IFillColorStop]
  transform: Matrix
}

export enum ImageFillScaleMode {
  FILL = 'FILL',
  FIT = 'FIT',
  CROP = 'CROP',
  TILE = 'TILE',
}

export interface IPaintFilter {
  tint: number
  shadows: number
  highlights: number
  exposure: number
  temperature: number
  vibrance: number
  contrast: number
}

export interface IImagePaint extends IBaseFill {
  type: FillType.IMAGE
  transform: Matrix
  image: {
    hash: string
    name: string
  }
  imageScaleMode: ImageFillScaleMode
  paintFilter?: IPaintFilter
  originalImageWidth: number
  originalImageHeight: number
}

export type IPaint =
  | ISolidColorPaint
  | IGradientLinearPaint
  | IGradientRadialPaint
  | IGradientAngularPaint
  | IGradientDiamondPaint
  | IImagePaint
