import type { Renderer } from '@latte-js/art'
import { HitTester } from '@latte-js/art'
import type { HitResult, IMouseWheelEvent, ILatteEvent } from '@latte-js/bean'
import { Emitter, Disposable, type Event } from '@latte-js/kit'
import { type SceneGraph, NULL_INDEX } from '@latte-js/espresso'
import {
  StandardMouseEvent,
  StandardWheelEvent,
  type IPoint,
} from '../dom/mouseEvent'

export enum EventResult {
  IGNORED = 0,
  CONSUMED = 1,
}

export interface IInputService {
  readonly onKeyDown: Event<KeyboardEvent>
  readonly onKeyUp: Event<KeyboardEvent>
}

export class InputMouseEvent extends StandardMouseEvent implements ILatteEvent {
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

export interface IInputMouseHandler {
  id: string
  priority: number // Higher priority first
  onEvent(e: InputMouseEvent | InputWheelEvent): EventResult
}

export class InputService extends Disposable implements IInputService {
  private _handlers: IInputMouseHandler[] = []
  private _hitTester: HitTester

  private readonly _onKeyDown = this._register(new Emitter<KeyboardEvent>())
  public readonly onKeyDown = this._onKeyDown.event

  private readonly _onKeyUp = this._register(new Emitter<KeyboardEvent>())
  public readonly onKeyUp = this._onKeyUp.event

  constructor(
    private _renderer: Renderer,
    private _sceneGraph: SceneGraph
  ) {
    super()
    this._hitTester = new HitTester(this._sceneGraph, this._renderer.camera)
    const canvas = this._renderer.canvas
    canvas.addEventListener('pointerdown', this._handleRaw)
    canvas.addEventListener('pointermove', this._handleRaw)
    canvas.addEventListener('pointerup', this._handleRaw)
    canvas.addEventListener('wheel', this._handleRaw, { passive: false })
    window.addEventListener('keydown', this._handleKeyDown)
    window.addEventListener('keyup', this._handleKeyUp)
  }

  public setGraph(graph: SceneGraph) {
    this._sceneGraph = graph
    this._hitTester.setGraph(graph)
  }

  public registerHandler(handler: IInputMouseHandler) {
    this._handlers.push(handler)
    this._handlers.sort((a, b) => b.priority - a.priority)
  }

  public removeHandler(id: string) {
    this._handlers = this._handlers.filter(h => h.id !== id)
  }

  public override dispose() {
    window.removeEventListener('keydown', this._handleKeyDown)
    window.removeEventListener('keyup', this._handleKeyUp)
    super.dispose()
  }

  private _handleKeyDown = (e: KeyboardEvent) => {
    this._onKeyDown.fire(e)
  }

  private _handleKeyUp = (e: KeyboardEvent) => {
    this._onKeyUp.fire(e)
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
