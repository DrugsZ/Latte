import type { BaristaSystem } from '../systems'

import type { DirtyBatch } from './dirtyBatch'

export class PipelineRunner {
  constructor(private readonly _systems: BaristaSystem) {}

  public process(batch: DirtyBatch) {
    if (!batch.hasChanges) {
      return
    }

    for (const system of this._systems.getScheduledSystems()) {
      const descriptor = system.getScheduleDescriptor()
      if (!descriptor || !batch.hasAny(descriptor.reads)) {
        continue
      }

      system.process?.(batch)
    }
  }
}
