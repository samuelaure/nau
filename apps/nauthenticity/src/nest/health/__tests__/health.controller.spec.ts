/**
 * HealthController unit test.
 *
 * The health endpoint is the simplest possible controller — it returns a
 * hardcoded status object. This test verifies the contract doesn't silently
 * change (e.g., someone renames the field and breaks monitoring dashboards).
 */
import { HealthController } from '../health.controller'

describe('HealthController', () => {
  let controller: HealthController

  beforeEach(() => {
    controller = new HealthController()
  })

  it('returns status ok with service name', () => {
    const result = controller.check()
    expect(result).toEqual({ status: 'ok', service: 'nauthenticity' })
  })
})
