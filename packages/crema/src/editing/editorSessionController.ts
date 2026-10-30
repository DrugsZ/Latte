import {
  Channels,
  FillType,
  NodeType,
  type IDType,
  type IStylePatch,
} from '@latte-js/bean'
import { NodeCursor, NULL_INDEX } from '@latte-js/espresso'
import { Disposable, Emitter } from '@latte-js/kit'

import type { EditorRuntime } from '../editorRuntime'

export interface SelectedNodeProperties {
  readonly id: IDType
  readonly type: NodeType
  readonly name: string
  /** World position; width and height are local dimensions. */
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly opacity: number
  readonly fill: string | null
}

export type EditableProperty =
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'name'
  | 'opacity'
  | 'fill'

/** Product actions use worker services; projection cursors are read-only. */
export class EditorSessionController extends Disposable {
  private readonly _change = this._register(new Emitter<void>())
  public readonly onDidChange = this._change.event

  constructor(private readonly _runtime: EditorRuntime) {
    super()
    const selection = _runtime.workbench!.selectionService
    this._register(selection.onSelectChange(() => this._change.fire()))
    this._register(
      _runtime.projection.onDidChange(() => {
        this._pruneSelection(false)
        this._change.fire()
      })
    )
  }

  public get selectionCount() {
    return this._runtime.workbench!.selectionService.ids.length
  }

  public get selected(): SelectedNodeProperties | null {
    const selection = this._runtime.workbench!.selectionService
    if (selection.ids.length !== 1 || !selection.activeId) return null
    const graph = this._runtime.editorHost.graph
    const index = graph.getIndex(selection.activeId)
    if (index === NULL_INDEX || graph.isNodeIndexTombstoned(index)) return null
    const cursor = new NodeCursor(graph, index)
    const fill = cursor.fills[0]
    return {
      id: selection.activeId,
      type: cursor.type,
      name: cursor.name,
      x: cursor.worldTransform[4],
      y: cursor.worldTransform[5],
      width: cursor.width,
      height: cursor.height,
      opacity: cursor.opacity,
      fill:
        fill?.type === FillType.SOLID
          ? `#${[fill.color.r, fill.color.g, fill.color.b]
              .map(channel =>
                Math.round(channel * 255)
                  .toString(16)
                  .padStart(2, '0')
              )
              .join('')}`
          : null,
    }
  }

  public async historyState() {
    const service = this._runtime.baristaClient.getService(Channels.UndoRedo)
    const [canUndo, canRedo] = await Promise.all([
      service.canUndo(),
      service.canRedo(),
    ])
    return { canUndo, canRedo }
  }

  public async updateProperty(
    id: IDType,
    key: EditableProperty,
    value: string
  ) {
    this._assertIdle()
    const selected = this.selected
    if (!selected || selected.id !== id) {
      throw new Error('Selection changed. Select the layer again.')
    }
    const transform = this._runtime.baristaClient.getService(Channels.Transform)
    const style = this._runtime.baristaClient.getService(Channels.Style)
    if (key === 'name') {
      await style.update([id], { name: value })
    } else if (key === 'fill') {
      if (!/^#[0-9a-f]{6}$/i.test(value)) {
        throw new Error('Enter a color as #RRGGBB.')
      }
      const channels = [1, 3, 5].map(
        offset => parseInt(value.slice(offset, offset + 2), 16) / 255
      )
      await style.update([id], {
        fills: [
          {
            type: FillType.SOLID,
            visible: true,
            opacity: 1,
            blendMode: 0,
            color: { r: channels[0], g: channels[1], b: channels[2], a: 1 },
          },
        ],
      })
    } else {
      const number = value.trim() === '' ? NaN : Number(value)
      if (!Number.isFinite(number) || !Number.isFinite(Math.fround(number)))
        throw new Error('Enter a finite number within the supported range.')
      if (key === 'x' || key === 'y') {
        await transform.moveTo(
          [id],
          [key === 'x' ? number : selected.x, key === 'y' ? number : selected.y]
        )
      } else if (key === 'width' || key === 'height') {
        if (selected.type !== NodeType.RECTANGLE) {
          throw new Error('Size editing currently supports rectangles.')
        }
        if (number <= 0) throw new Error('Size must be greater than zero.')
        await transform.resize(
          [id],
          key === 'width' ? number : selected.width,
          key === 'height' ? number : selected.height
        )
      } else {
        if (number < 0 || number > 1)
          throw new Error('Opacity must be between 0 and 1.')
        await style.update([id], { opacity: number } satisfies IStylePatch)
      }
    }
    this._change.fire()
  }

  public async undo() {
    this._assertIdle()
    await this._runtime.baristaClient.getService(Channels.UndoRedo).undo()
    this._pruneSelection()
    this._change.fire()
  }

  public async redo() {
    this._assertIdle()
    await this._runtime.baristaClient.getService(Channels.UndoRedo).redo()
    this._change.fire()
  }

  public async save() {
    this._assertIdle()
    return this._runtime.baristaClient.getService(Channels.Document).save()
  }

  private _assertIdle() {
    if (this._runtime.transformInteraction.isActive) {
      throw new Error('Finish the current drag before editing or saving.')
    }
  }

  private _pruneSelection(removeMissing = true) {
    const selection = this._runtime.workbench!.selectionService
    const graph = this._runtime.editorHost.graph
    const ids = selection.ids.filter(id => {
      const index = graph.getIndex(id)
      return index === NULL_INDEX
        ? !removeMissing
        : !graph.isNodeIndexTombstoned(index)
    })
    if (ids.length !== selection.ids.length) selection.select(ids)
  }
}
