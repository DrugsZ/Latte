import { describe, expect, it } from 'vitest'

import { RenderReason, RenderScheduler } from '../renderScheduler'

describe('RenderScheduler', () => {
  it('deduplicates render reasons until consumed', () => {
    const scheduler = new RenderScheduler()

    scheduler.request(RenderReason.CameraChanged)
    scheduler.request(RenderReason.CameraChanged)
    scheduler.request(RenderReason.SceneDirty)

    expect(scheduler.hasPending).toBe(true)
    expect(scheduler.consume()).toEqual([
      RenderReason.CameraChanged,
      RenderReason.SceneDirty,
    ])
    expect(scheduler.hasPending).toBe(false)
  })

  it('uses manual as the default render reason', () => {
    const scheduler = new RenderScheduler()

    scheduler.request()

    expect(scheduler.consume()).toEqual([RenderReason.Manual])
  })
})
