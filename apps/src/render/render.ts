// load and manage textures
interface Texture {}

interface Graphics {
  circle(cx: number, cy: number, radius: number): void

  rect(x: number, y: number, width: number, height: number): void

  roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radii:
      | number
      | [number, number]
      | [number, number, number]
      | [number, number, number, number]
  ): void

  line(x1: number, y1: number, x2: number, y2: number): void

  ellipse(
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    counterclockwise: boolean
  ): void

  text(text: string, x: number, y: number, maxWidth): void
}

interface Canvas {
  setSize(w: number, h: number): void

  clear(x: number, y: number, w: number, h: number): void

  setTransform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number
  ): void

  resetTransform(): void
}

export interface IRenderService {
  Graphics: Graphics

  Texture: Texture

  Canvas: Canvas

  init(): void

  view: HTMLCanvasElement

  onReady(): void

  onBeforeRender(): void

  onAfterRender(): void

  onBeforeDestroy(): void

  onAfterDestroy(): void
}
