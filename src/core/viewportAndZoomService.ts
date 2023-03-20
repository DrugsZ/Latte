import { Emitter } from 'Cditor/common/event'
import Page from 'Cditor/core/page'

class Viewport {
  private _x: number = 0
  private _y: number = 0
  private _width: number = 0
  private _height: number = 0

  private readonly _onViewportChange = new Emitter<RectBBox>()
  public readonly onViewportChange = this._onViewportChange.event

  constructor(size: RectBBox) {
    this.setViewport(size)
  }

  getViewport() {
    return {
      x: this._x,
      y: this._y,
      width: this._width,
      height: this._height,
    }
  }

  setViewport(size: RectBBox) {
    this._x = size.x ?? this._x
    this._y = size.y ?? this._y
    this._width = size.width ?? this._width
    this._height = size.height ?? this._height
    this._onViewportChange.fire(this.getViewport())
  }
}

class EditorZoom {
  constructor(private _zoom: number = 1) {}

  private readonly _onZoomChange = new Emitter<number>()
  public readonly onZoomChange = this._onZoomChange.event

  getZoom() {
    return this._zoom
  }

  setZoom(value: number) {
    this._zoom = value
    this._onZoomChange.fire(this.getZoom())
  }
}

class ViewportAndZoomService {
  private _viewportAndZoomMaps: Map<
    Page,
    {
      viewport: Viewport
      zoom: EditorZoom
    }
  > = new Map()

  private _initInstanceForPage(page: Page) {
    const size = page.getBoundingClientRect()
    const viewport = new Viewport(size)
    const zoom = new EditorZoom()
    this._viewportAndZoomMaps.set(page, {
      viewport,
      zoom,
    })
  }
  getViewport(page: Page): Viewport {
    if (!this._viewportAndZoomMaps.has(page)) {
      this._initInstanceForPage(page)
    }
    const result = this._viewportAndZoomMaps.get(page)
    return result!.viewport
  }
  getZoom(page: Page): EditorZoom {
    if (!this._viewportAndZoomMaps.has(page)) {
      this._initInstanceForPage(page)
    }
    const result = this._viewportAndZoomMaps.get(page)
    return result!.zoom
  }
}

export default ViewportAndZoomService
