import type { Renderer } from '@latte-js/art'
import { HitTester } from '@latte-js/art'
import type { HitResult } from '@latte-js/bean'
import { type SceneGraph, NULL_INDEX } from '@latte-js/espresso'
import {
  StandardMouseEvent,
  StandardWheelEvent,
  type IMouseWheelEvent,
  type IPoint,
} from '../dom/mouseEvent'

export enum EventResult {
  IGNORED = 0,
  CONSUMED = 1,
}

export class InputMouseEvent extends StandardMouseEvent {
  constructor(
    browserEvent: MouseEvent,
    public readonly hitResult: HitResult | undefined,
    public readonly client: IPoint
  ) {
    super(browserEvent)
  }
}

export class InputWheelEvent extends StandardWheelEvent {
  constructor(
    browserEvent: IMouseWheelEvent,
    public readonly hitResult: HitResult | undefined,
    client: IPoint
  ) {
    super(browserEvent, client)
  }
}

export interface IInputHandler {
  id: string
  priority: number // Higher priority first
  onEvent(e: InputMouseEvent | InputWheelEvent): EventResult
}

export class InputService {
  private _handlers: IInputHandler[] = []
  private _hitTester: HitTester

  constructor(
    private _renderer: Renderer,
    private _sceneGraph: SceneGraph
  ) {
    this._hitTester = new HitTester(this._sceneGraph, this._renderer.camera)
    const canvas = this._renderer.canvas
    canvas.addEventListener('pointerdown', this._handleRaw)
    canvas.addEventListener('pointermove', this._handleRaw)
    canvas.addEventListener('pointerup', this._handleRaw)
    canvas.addEventListener('wheel', this._handleRaw, { passive: false })
  }

  public registerHandler(handler: IInputHandler) {
    this._handlers.push(handler)
    this._handlers.sort((a, b) => b.priority - a.priority)
  }

  public removeHandler(id: string) {
    this._handlers = this._handlers.filter(h => h.id !== id)
  }

  private _handleRaw = (rawEvent: PointerEvent | WheelEvent) => {
    let hitResult: HitResult | undefined
    if (this._renderer.activeRootId) {
      const x =
        rawEvent instanceof PointerEvent ? rawEvent.clientX : rawEvent.clientX
      const y =
        rawEvent instanceof PointerEvent ? rawEvent.clientY : rawEvent.clientY

      const rTreeHits = this._renderer.rTree.search({
        minX: x,
        minY: y,
        maxX: x,
        maxY: y,
      })

      const candidates = new Set<number>()
      for (const item of rTreeHits) {
        let curr = (item as any).id
        while (curr !== NULL_INDEX) {
          if (candidates.has(curr)) break
          candidates.add(curr)
          curr = this._sceneGraph.parent[curr]
        }
      }

      const idx = this._hitTester.hitTest(
        x,
        y,
        this._renderer.activeRootId,
        candidates
      )
      if (idx !== NULL_INDEX) {
        hitResult = {
          nodeIndex: idx,
          nodeId: this._sceneGraph.getUUID(idx) || undefined,
        }
      }
    }

    const worldPos = this._renderer.camera.toWorld(
      rawEvent.clientX,
      rawEvent.clientY
    )

    let event: InputMouseEvent | InputWheelEvent

    if (rawEvent instanceof WheelEvent) {
      event = new InputWheelEvent(
        rawEvent as IMouseWheelEvent,
        hitResult,
        worldPos
      )
    } else {
      event = new InputMouseEvent(rawEvent as PointerEvent, hitResult, worldPos)
    }

    for (const handler of this._handlers) {
      const result = handler.onEvent(event)
      if (result === EventResult.CONSUMED) {
        break
      }
    }
  }
}
