import type {
 EditorHost ,
  type IInputMouseHandler,
  type InputMouseEvent,
  type InputWheelEvent,
  CommandsRegistry,
  EventResult } from '@latte-js/syrup';

import type { ITool } from '@latte-js/bean'
import type { SceneGraph } from '@latte-js/espresso'

export class ToolService implements IInputMouseHandler {
  public readonly id = 'tool-service'
  public priority = Number.MAX_SAFE_INTEGER

  private _tools: Map<string, ITool> = new Map()
  private _activeTool: ITool | null = null
  private readonly _commandDisposables: (() => void)[] = []

  constructor(private readonly _editor: EditorHost<SceneGraph>) {
    this._commandDisposables.push(
      CommandsRegistry.registerCommand(
        'editor.tool.active',
        this._handleActivateToolCommand.bind(this)
      )
    )
    this._commandDisposables.push(
      CommandsRegistry.registerCommand(
        'editor.tool.deactivate',
        this.deactivateCurrentTool.bind(this)
      )
    )
  }

  public onEvent(e: InputMouseEvent | InputWheelEvent): EventResult {
    const tool = this._activeTool
    if (!tool) {
      return EventResult.IGNORED
    }
    const { activeDocument } = this._editor
    if (!activeDocument) {
      return EventResult.IGNORED
    }
    ;(e as any).activeDocument = activeDocument
    const type = e.browserEvent?.type
    if (type === 'pointerdown') {
      tool.onPointerDown?.(e as any)
    } else if (type === 'pointermove') {
      tool.onPointerMove?.(e as any)
    } else if (type === 'pointerup') {
      tool.onPointerUp?.(e as any)
    } else if (type === 'dblclick') {
      tool.onDoubleTap?.(e as any)
    }
    return EventResult.CONSUMED
  }

  private async _handleActivateToolCommand(toolId: string): Promise<void> {
    this.activateTool(toolId)
  }

  public registerTool(tool: ITool): void {
    this._tools.set(tool.id, tool)
  }

  public activateTool(toolId: string): void {
    const tool = this._tools.get(toolId)
    if (!tool) {
      throw new Error(`Tool with id ${toolId} not found`)
    }

    if (this._activeTool) {
      this._activeTool.deactivate()
    }

    this._activeTool = tool
    this._activeTool.activate()
  }

  public deactivateCurrentTool(): void {
    if (this._activeTool) {
      this._activeTool.deactivate()
      this._activeTool = null
    }
  }

  public dispose() {
    this.deactivateCurrentTool()
    for (const dispose of this._commandDisposables.splice(0)) {
      dispose()
    }
  }

  get activeTool(): ITool | null {
    return this._activeTool
  }
}
