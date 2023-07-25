export class ViewEventHandler {
  private _shouldRender: boolean = true

  public shouldRender(): boolean {
    return this._shouldRender
  }

  public forceShouldRender(): void {
    this._shouldRender = true
  }

  protected setShouldRender(): void {
    this._shouldRender = true
  }

  public onDidRender(): void {
    this._shouldRender = false
  }
}
