export interface IUndoRedoService {
  undo(): Promise<boolean>
  redo(): Promise<boolean>
  canUndo(): Promise<boolean>
  canRedo(): Promise<boolean>
}
