import {
  InteractionGroupResolver,
  NodeLifecycle,
  NULL_INDEX,
  type InteractionGroupBox,
  type SceneGraph,
} from '@latte-js/espresso'

import type { IDType, NodeType } from '@latte-js/bean'
import type { SelectionService } from './selectionService'

export interface SelectionTargetSnapshot {
  readonly id: IDType
  readonly index: number
  readonly type: NodeType
}

export interface SelectionSnapshot {
  readonly selectionVersion: number
  readonly documentRevision: number
  readonly requestedIds: readonly IDType[]
  readonly targets: readonly SelectionTargetSnapshot[]
  readonly geometry: InteractionGroupBox<SelectionTargetSnapshot> | null
}

export interface SelectionModelOptions {
  readonly documentId?: string
}

export class SelectionModel {
  private _cachedKey: string | null = null
  private _cachedSnapshot: SelectionSnapshot | null = null

  constructor(
    private readonly _selectionService: SelectionService,
    private readonly _sceneGraph: SceneGraph,
    private readonly _options: SelectionModelOptions = {}
  ) {}

  public getSnapshot(documentRevision: number): SelectionSnapshot | null {
    const requestedIds = this._selectionService.ids
    const key = [
      this._options.documentId ?? 'default',
      this._selectionService.selectionVersion,
      documentRevision,
    ].join(':')

    if (this._cachedKey === key && this._cachedSnapshot) {
      return this._cachedSnapshot
    }

    const snapshot = this._sceneGraph.readConsistent(() => {
      const targets = this._resolveTargets(requestedIds)
      const geometry = new InteractionGroupResolver<SelectionTargetSnapshot>({
        getBaseSize: target => this._readSize(target.index),
        getBaseWorldMatrix: target => this._readWorldMatrix(target.index),
      }).resolve(targets)

      return {
        selectionVersion: this._selectionService.selectionVersion,
        documentRevision,
        requestedIds,
        targets,
        geometry,
      }
    })

    if (!snapshot) {
      return null
    }

    this._cachedKey = key
    this._cachedSnapshot = snapshot
    return snapshot
  }

  private _resolveTargets(ids: readonly IDType[]): SelectionTargetSnapshot[] {
    const targets: SelectionTargetSnapshot[] = []
    for (const id of ids) {
      const index = this._sceneGraph.getIndex(id)
      if (
        index === NULL_INDEX ||
        (this._sceneGraph.lifecycle[index] & NodeLifecycle.Active) === 0
      ) {
        continue
      }

      targets.push({
        id,
        index,
        type: this._sceneGraph.type[index] as NodeType,
      })
    }
    return targets
  }

  private _readSize(index: number) {
    return {
      width: this._sceneGraph.size[index * 2],
      height: this._sceneGraph.size[index * 2 + 1],
    }
  }

  private _readWorldMatrix(index: number) {
    const ptr = index * 6
    return [
      this._sceneGraph.worldMatrix[ptr],
      this._sceneGraph.worldMatrix[ptr + 1],
      this._sceneGraph.worldMatrix[ptr + 2],
      this._sceneGraph.worldMatrix[ptr + 3],
      this._sceneGraph.worldMatrix[ptr + 4],
      this._sceneGraph.worldMatrix[ptr + 5],
    ] as [number, number, number, number, number, number]
  }
}
