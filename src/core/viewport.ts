import { Emitter } from 'Cditor/common/event'

export interface IViewPort {
  x:number
  y:number
  zoom:number
}

class Viewport {

  private _x: number = 0
  private _y: number = 0
  private _zoom: number = 1

  private readonly _onViewportChange = new Emitter<IViewPort>()
  public readonly onViewportChange = this._onViewportChange.event

  constructor(size:IViewPort) {
    this.setViewport(size)
  }

  getViewport(){
    return {
      x: this._x,
      y: this._y,
      zoom: this._zoom
    }
  }

  setViewport(size:IViewPort){
    this._x = size.x ?? this._x
    this._y = size.y ?? this._y
    this._zoom = size.zoom ?? this._zoom
    this._onViewportChange.fire({
      x: this._x,
      y: this._y,
      zoom:this._zoom
    })
  }
}

export default Viewport