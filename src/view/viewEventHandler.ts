/* eslint-disable @typescript-eslint/no-unused-vars */
import * as viewEvents from 'Latte/view/viewEvents'

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

  public onFocusPageChange(
    event: viewEvents.ViewFocusPageChangeEvent
  ): boolean {
    return false
  }

  public onCameraChange(event: viewEvents.ViewCameraUpdateEvent): boolean {
    return false
  }

  public onElementChange(event: viewEvents.ViewElementChangeEvent): boolean {
    return false
  }

  public onActiveSelectionChange(
    event: viewEvents.ViewActiveSelectionChangeEvent
  ): boolean {
    return false
  }

  public onHoverObjectChange(
    event: viewEvents.ViewHoverObjectChangeEvent
  ): boolean {
    return false
  }

  public onHoverControllerKeyChange(
    event: viewEvents.ViewHoverControllerKeyChangeEvent
  ): boolean {
    return false
  }

  public onOperateModeChange(
    event: viewEvents.ViewCursorOperateModeChange
  ): boolean {
    return false
  }

  public onCursorMove(event: viewEvents.ViewCursorMoveEvent): boolean {
    return false
  }

  public onCursorStateChange(
    event: viewEvents.ViewCursorStateChangeEvent
  ): boolean {
    return false
  }

  public handleEvents(events: viewEvents.ViewEvent[]) {
    let shouldRender = false

    events.forEach(event => {
      switch (event.type) {
        case viewEvents.ViewEventType.ViewFocusPageChange:
          if (this.onFocusPageChange(event)) {
            shouldRender = true
          }
          break

        case viewEvents.ViewEventType.ViewActiveSelectionChange:
          if (this.onActiveSelectionChange(event)) {
            shouldRender = true
          }
          break

        case viewEvents.ViewEventType.ViewCameraChange:
          if (this.onCameraChange(event)) {
            shouldRender = true
          }
          break

        case viewEvents.ViewEventType.ViewElementChange:
          if (this.onElementChange(event)) {
            shouldRender = true
          }
          break
        case viewEvents.ViewEventType.ViewHoverObjectChange:
          if (this.onHoverObjectChange(event)) {
            shouldRender = true
          }
          break
        case viewEvents.ViewEventType.ViewHoverControllerKeyChange:
          if (this.onHoverControllerKeyChange(event)) {
            shouldRender = true
          }
          break
        case viewEvents.ViewEventType.ViewCursorOperateModeChange:
          if (this.onOperateModeChange(event)) {
            shouldRender = true
          }
          break
        case viewEvents.ViewEventType.ViewCursorMove:
          if (this.onCursorMove(event)) {
            shouldRender = true
          }
          break
        case viewEvents.ViewEventType.ViewCursorStateChange:
          if (this.onCursorStateChange(event)) {
            shouldRender = true
          }
          break
        default:
          console.info('View received unknown event: ')
          console.info(event)
      }
    })

    if (shouldRender) {
      this._shouldRender = true
    }
  }
}
