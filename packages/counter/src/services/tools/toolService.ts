import {
  type IInputMouseHandler,
  type InputMouseEvent,
  type InputWheelEvent,
  CommandsRegistry,
  EventResult,
  IEditorService,
} from '@latte-js/syrup'

import type { ITool } from '@latte-js/bean'

export class ToolService implements IInputMouseHandler {
  public readonly id = 'tool-service'
  public priority = Number.MAX_SAFE_INTEGER

  private _tools: Map<string, ITool> = new Map()
  private _activeTool: ITool | null = null

  constructor(@IEditorService private readonly _editorService: IEditorService) {
    CommandsRegistry.registerCommand(
      'editor.tool.active',
      this._handleActivateToolCommand.bind(this)
    )
    CommandsRegistry.registerCommand(
      'editor.tool.deactivate',
      this.deactivateCurrentTool.bind(this)
    )
  }

  public onEvent(e: InputMouseEvent | InputWheelEvent): EventResult {
    const tool = this._activeTool
    if (!tool) {
      return EventResult.IGNORED
    }
    const { activeEditor } = this._editorService
    if (!activeEditor) {
      return EventResult.IGNORED
    }
    ;(e as any).editor = activeEditor
    const type = e.browserEvent?.type
    if (type === 'mousedown') {
      tool.onPointerDown?.(e as any)
    } else if (type === 'mousemove') {
      tool.onPointerMove?.(e as any)
    } else if (type === 'mouseup') {
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

  get activeTool(): ITool | null {
    return this._activeTool
  }
}
