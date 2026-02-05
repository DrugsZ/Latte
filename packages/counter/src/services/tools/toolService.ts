import {
  type InputMouseEvent,
  type InputWheelEvent,
  EventResult,
  CommandsRegistry,
  type IInputMouseHandler,
} from '@latte-js/syrup'
import type { ITool } from '@latte-js/bean'

export class ToolService implements IInputMouseHandler {
  public readonly id = 'tool-service'
  public priority = Number.MAX_SAFE_INTEGER

  private _tools: Map<string, ITool> = new Map()
  private _activeTool: ITool | null = null

  constructor() {
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
    return EventResult.IGNORED
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
