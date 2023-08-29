import type { ViewModel } from 'Latte/core/viewModel'

export abstract class CoreEditorCommand<T> {
  public abstract runCoreEditorCommand(
    viewModel: ViewModel,
    args: Partial<T>
  ): void
}

export namespace CoreMouseDragCommands {}
