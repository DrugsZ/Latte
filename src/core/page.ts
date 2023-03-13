import { HightBaseElement } from 'Cditor/core/baseElement'

// class Page extends HightBaseElement {
//   private _model: PAGE
//   id: string
//   private _offScreenCanvas: OffscreenCanvas
//   private _viewport: Viewport
//   private _zoom: EditorZoom

//   constructor(model: PAGE, offsetCanvas: OffscreenCanvas) {
//     this._model = model
//     this.id = model.id
//     this._offScreenCanvas = offsetCanvas
//     this._initElement()
//     this._initViewportAndZoom()
//   }

//   private _initElement() {
//     const { children } = this._model
//     children.forEach((child) => {
//       this._elements.push(createElement(child))
//     })
//   }

//   private getAllElementsBBox() {
//     const bBox: IRectBBox = {
//       x: 0,
//       y: 0,
//       width: this._offScreenCanvas.width,
//       height: this._offScreenCanvas.height,
//     }

//     this._elements.forEach((element) => {
//       const elementBBox = element.getBoundingClientRect()
//       bBox.x = Math.min(bBox.x, elementBBox.x)
//       bBox.y = Math.min(bBox.y, elementBBox.y)
//       bBox.width = Math.max(bBox.width, elementBBox.width + elementBBox.x)
//       bBox.height = Math.max(bBox.height, elementBBox.height + elementBBox.y)
//     })
//     bBox.width -= bBox.x
//     bBox.height -= bBox.y

//     return bBox
//   }

//   private _initViewportAndZoom() {
//     const bBox = this.getAllElementsBBox()
//     const { x, y } = bBox
//     const canvasSize = {
//       width: this._offScreenCanvas.width,
//       height: this._offScreenCanvas.height,
//     }
//     const xZoom =
//       (bBox.width + EDITOR_PAGE_DEFAULT_PADDING_VALUE) / canvasSize.width
//     const yZoom =
//       (bBox.height + EDITOR_PAGE_DEFAULT_PADDING_VALUE) / canvasSize.height
//     const zoom = Math.min(xZoom, yZoom)
//     this._zoom = new EditorZoom(zoom)
//     this._viewport = new Viewport({
//       x,
//       y,
//       width: this._offScreenCanvas.width,
//       height: this._offScreenCanvas.height,
//     })
//     this._viewport.onViewportChange(this.renderPage, this)
//   }

//   private _renderElements() {
//     const ctx = this._offScreenCanvas.getContext(
//       '2d'
//     ) as unknown as CanvasRenderingContext2D
//     const viewportInfo = this._viewport.getViewport()
//     const zoom = this._zoom.getZoom()
//     ctx.scale(1 / zoom, 1 / zoom)
//     const actualVisibleSize = {
//       width: viewportInfo.width * zoom,
//       height: viewportInfo.height * zoom,
//     }
//     const translateX = actualVisibleSize.width / 2 + viewportInfo.x
//     const translateY = actualVisibleSize.height / 2 + viewportInfo.y
//     ctx.translate(translateX / zoom, translateY / zoom)
//     this._elements.forEach((element) => {
//       ctx.save()
//       element.render(ctx)
//       ctx.restore()
//     })
//   }

//   renderPage() {
//     const { backgrounds } = this._model
//     const { color } = backgrounds[0]
//     const fillColor = `rgb(${255 * color.r}, ${255 * color.g}, ${
//       255 * color.b
//     })`
//     const ctx = this._offScreenCanvas.getContext(
//       '2d'
//     ) as unknown as CanvasRenderingContext2D
//     ctx.setTransform(1, 0, 0, 1, 0, 0)
//     ctx.clearRect(
//       0,
//       0,
//       this._offScreenCanvas.width,
//       this._offScreenCanvas.height
//     )
//     ctx.fillStyle = fillColor
//     ctx.fillRect(
//       0,
//       0,
//       this._offScreenCanvas.width,
//       this._offScreenCanvas.height
//     )
//     this._renderElements()
//   }
// }

class Page extends HightBaseElement {}

export default Page
