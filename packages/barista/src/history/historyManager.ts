import {
  MutationScopeKind,
  type ISceneGraphMutationAuthority,
  type INodeMutationRecord,
  type SceneGraph,
} from '@latte-js/espresso'

import { MutationRecordApplier } from './mutationRecordApplier'
import { MutationRecordCompressor } from './mutationRecordCompressor'
import { invertRecords } from './mutationRecords'
import { TransactionLabel } from '../transactions/transactionLabels'

import type { ICommittedTransaction } from '../transactions/transactionManager'

export interface IHistoryEntry {
  readonly label: string
  readonly records: readonly INodeMutationRecord[]
  readonly inverseRecords: readonly INodeMutationRecord[]
}

interface IHistoryStack {
  undoStack: IHistoryEntry[]
  redoStack: IHistoryEntry[]
}

const normalizeResourceId = (resourceId: string) => {
  if (!resourceId) {
    throw new Error('[HistoryManager] resourceId is required')
  }
  return resourceId
}

export class HistoryManager {
  private _stacks = new Map<string, IHistoryStack>()
  private readonly _applier: MutationRecordApplier
  private readonly _compressor: MutationRecordCompressor

  constructor(
    private readonly _sceneGraph: SceneGraph,
    private _mutationAuthority?: ISceneGraphMutationAuthority,
    compressor?: MutationRecordCompressor,
    applier?: MutationRecordApplier
  ) {
    this._applier = applier ?? new MutationRecordApplier(_sceneGraph)
    this._compressor = compressor ?? new MutationRecordCompressor()
  }

  public canUndo(resourceId: string) {
    return this._getStack(resourceId).undoStack.length > 0
  }

  public canRedo(resourceId: string) {
    return this._getStack(resourceId).redoStack.length > 0
  }

  public setMutationAuthority(authority: ISceneGraphMutationAuthority) {
    this._mutationAuthority = authority
  }

  public push(resourceId: string, transaction: ICommittedTransaction | null) {
    resourceId = normalizeResourceId(resourceId)
    if (!transaction || transaction.records.length === 0) {
      return
    }

    const records = this._compressor.compress(transaction.records)
    if (records.length === 0) {
      return
    }

    const stack = this._getStack(resourceId)
    this._finalizeEntries(stack.redoStack)
    stack.undoStack.push({
      label: transaction.label,
      records,
      inverseRecords: invertRecords(records),
    })
    stack.redoStack = []
  }

  public undo(resourceId: string) {
    this._assertCanApplyHistory('undo')
    const stack = this._getStack(resourceId)
    const entry = stack.undoStack.pop()
    if (!entry) {
      return false
    }

    this._applier.applyRecords(entry.inverseRecords)
    stack.redoStack.push(entry)
    return true
  }

  public redo(resourceId: string) {
    this._assertCanApplyHistory('redo')
    const stack = this._getStack(resourceId)
    const entry = stack.redoStack.pop()
    if (!entry) {
      return false
    }

    this._applier.applyRecords(entry.records)
    stack.undoStack.push(entry)
    return true
  }

  public peekUndo(resourceId: string): IHistoryEntry | null {
    const { undoStack } = this._getStack(resourceId)
    return undoStack[undoStack.length - 1] ?? null
  }

  public peekRedo(resourceId: string): IHistoryEntry | null {
    const { redoStack } = this._getStack(resourceId)
    return redoStack[redoStack.length - 1] ?? null
  }

  public removeResource(resourceId: string) {
    resourceId = normalizeResourceId(resourceId)
    const stack = this._stacks.get(resourceId)
    if (stack) {
      this._finalizeEntries([...stack.undoStack, ...stack.redoStack])
    }
    this._stacks.delete(resourceId)
  }

  private _getStack(resourceId: string): IHistoryStack {
    resourceId = normalizeResourceId(resourceId)
    let stack = this._stacks.get(resourceId)
    if (!stack) {
      stack = { undoStack: [], redoStack: [] }
      this._stacks.set(resourceId, stack)
    }
    return stack
  }

  private _assertCanApplyHistory(action: 'undo' | 'redo') {
    if (this._sceneGraph.getMutationRecorder()) {
      throw new Error(
        `[HistoryManager] Cannot ${action} while another mutation recorder is active`
      )
    }
  }

  private _finalizeEntries(entries: readonly IHistoryEntry[]) {
    if (entries.length === 0) {
      return
    }

    this._sceneGraph.runWithMutationScope(
      this._getMutationAuthority('HistoryManager.finalizeEntries'),
      {
        kind: MutationScopeKind.WriteNoHistory,
        label: TransactionLabel.FinalizeHistoryTombstones,
        source: 'HistoryManager.finalizeEntries',
      },
      () => {
        for (const entry of entries) {
          this._applier.finalizeTombstones(entry.records)
          this._applier.finalizeTombstones(entry.inverseRecords)
        }
      }
    )
  }

  private _getMutationAuthority(source: string) {
    if (this._mutationAuthority) {
      return this._mutationAuthority
    }
    if (this._sceneGraph.mutationGuardEnabled) {
      throw new Error(
        `[HistoryManager] Missing mutation authority for ${source}`
      )
    }
    return this._sceneGraph.createMutationAuthority(source)
  }
}
