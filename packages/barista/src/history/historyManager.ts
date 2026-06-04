import type { SceneGraph, INodeMutationRecord } from '@latte-js/espresso'

import { MutationRecordApplier } from './mutationRecordApplier'
import { invertRecords } from './mutationRecords'

import type {
  ICommittedTransaction,
  TransactionManager,
} from '../transactions/transactionManager'

export interface IHistoryEntry {
  readonly label: string
  readonly records: readonly INodeMutationRecord[]
  readonly inverseRecords: readonly INodeMutationRecord[]
}

export class HistoryManager {
  private _undoStack: IHistoryEntry[] = []
  private _redoStack: IHistoryEntry[] = []
  private readonly _applier: MutationRecordApplier

  constructor(
    private readonly _sceneGraph: SceneGraph,
    private readonly _transactions: TransactionManager,
    applier?: MutationRecordApplier
  ) {
    this._applier = applier ?? new MutationRecordApplier(_sceneGraph)
  }

  public get canUndo() {
    return this._undoStack.length > 0
  }

  public get canRedo() {
    return this._redoStack.length > 0
  }

  public push(transaction: ICommittedTransaction | null) {
    if (!transaction || transaction.records.length === 0) {
      return
    }

    this._undoStack.push({
      label: transaction.label,
      records: transaction.records,
      inverseRecords: invertRecords(transaction.records),
    })
    this._redoStack = []
  }

  public undo() {
    this._assertCanApplyHistory('undo')
    const entry = this._undoStack.pop()
    if (!entry) {
      return false
    }

    this._applier.applyRecords(entry.inverseRecords)
    this._redoStack.push(entry)
    return true
  }

  public redo() {
    this._assertCanApplyHistory('redo')
    const entry = this._redoStack.pop()
    if (!entry) {
      return false
    }

    this._applier.applyRecords(entry.records)
    this._undoStack.push(entry)
    return true
  }

  public peekUndo(): IHistoryEntry | null {
    return this._undoStack[this._undoStack.length - 1] ?? null
  }

  public peekRedo(): IHistoryEntry | null {
    return this._redoStack[this._redoStack.length - 1] ?? null
  }

  private _assertCanApplyHistory(action: 'undo' | 'redo') {
    if (this._transactions.isActive) {
      throw new Error(
        `[HistoryManager] Cannot ${action} while a transaction is active`
      )
    }
    if (this._sceneGraph.getMutationRecorder()) {
      throw new Error(
        `[HistoryManager] Cannot ${action} while another mutation recorder is active`
      )
    }
  }
}
