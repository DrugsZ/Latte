export abstract class Part {
  id: string
  private _parent: HTMLElement | undefined
  private _contentArea: HTMLElement | undefined
  constructor(id: string) {
    this.id = id
  }

  create(parent: HTMLElement, options?: object): void {
    this._parent = parent
    this._contentArea = this.createContentArea(parent, options)
  }

  protected createContentArea(
    parent: HTMLElement,
    options?: object
  ): HTMLElement | undefined {
    return undefined
  }
}
