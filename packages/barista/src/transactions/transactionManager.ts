import {
  TransformOps,
  type SceneGraph,
  type IMutationRecorder,
  type INodeMutationRecord,
} from '@latte-js/espresso'

import { MutationRecordApplier } from '../history/mutationRecordApplier'
import { cloneRecord, invertRecords } from '../history/mutationRecords'

import type { IDType } from '@latte-js/bean'

export interface ITransformSnapshot {
  readonly index: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly transform: Float32Array
  readonly worldTransform: Float32Array
}

interface IActiveTransaction {
  readonly label: string
  readonly snapshots: Map<IDType, ITransformSnapshot>
  readonly records: INodeMutationRecord[]
}

export interface ICommittedTransaction {
  readonly label: string
  readonly records: readonly INodeMutationRecord[]
}

export class TransactionManager implements IMutationRecorder {
  private _active: IActiveTransaction | null = null
  private readonly _applier: MutationRecordApplier

  constructor(
    private readonly _sceneGraph: SceneGraph,
    applier?: MutationRecordApplier
  ) {
    this._applier = applier ?? new MutationRecordApplier(_sceneGraph)
  }

  public get isActive() {
    return this._active !== null
  }

  public begin(label: string, ids: IDType[]) {
    if (this._active) {
      throw new Error(
        `[TransactionManager] Cannot begin "${label}" while "${this._active.label}" is active`
      )
    }
    const activeRecorder = this._sceneGraph.getMutationRecorder()
    if (activeRecorder && activeRecorder !== this) {
      throw new Error(
        `[TransactionManager] Cannot begin "${label}" while another mutation recorder is active`
      )
    }

    this._active = {
      label,
      snapshots: new Map(),
      records: [],
    }
    this._sceneGraph.setMutationRecorder(this)
    this.capture(ids)
  }

  public capture(ids: IDType[]) {
    if (!this._active) {
      return
    }

    for (const id of ids) {
      if (this._active.snapshots.has(id)) {
        continue
      }
      const index = this._sceneGraph.getIndex(id)
      if (index < 0) {
        continue
      }
      this._active.snapshots.set(id, {
        index,
        x: TransformOps.getX(this._sceneGraph, index),
        y: TransformOps.getY(this._sceneGraph, index),
        width: TransformOps.getWidth(this._sceneGraph, index),
        height: TransformOps.getHeight(this._sceneGraph, index),
        transform: Float32Array.from(
          TransformOps.getMatrix(this._sceneGraph, index)
        ),
        worldTransform: Float32Array.from(
          TransformOps.getWorldMatrix(this._sceneGraph, index)
        ),
      })
    }
  }

  public getSnapshot(id: IDType): ITransformSnapshot | undefined {
    return this._active?.snapshots.get(id)
  }

  public getMutationRecords(): readonly INodeMutationRecord[] {
    return this._active?.records ?? []
  }

  public recordMutation(record: INodeMutationRecord) {
    if (!this._active) {
      return
    }
    this._active.records.push(record)
  }

  public commit(): ICommittedTransaction | null {
    if (!this._active) {
      return null
    }

    const active = this._active
    const records = this._active.records.map(cloneRecord)

    this._sceneGraph.setMutationRecorder(null)
    this._active = null
    return {
      label: active.label,
      records,
    }
  }

  public abort() {
    if (!this._active) {
      return
    }
    const active = this._active
    this._sceneGraph.setMutationRecorder(null)
    this._active = null

    this._applier.applyRecords(invertRecords(active.records))
  }
}
