interface IContextViewShowOptions {
  render(container: HTMLElement): void
  onFocus?(): void
}

export class ContextView {
  private _view: HTMLElement
  private _container: HTMLElement

  constructor(container: HTMLElement) {
    this._view = document.createElement('div')
    this._view.className = 'context-view'
    container.appendChild(this._view)
  }

  public setContainer(container: HTMLElement) {
    this._container.removeChild(this._view)
    this._container = container
    this._container.appendChild(this._view)
  }

  public hide() {
    this._view.style.display = 'none'
    this._view.innerHTML = ''
  }

  public show(options: IContextViewShowOptions) {
    this.hide()
    this._view.style.display = 'block'
    this._view.style.left = '0px'
    this._view.style.top = '0px'
    this._view.style.position = 'absolute'
    options.render(this._view)
    options.onFocus?.()
  }
}
