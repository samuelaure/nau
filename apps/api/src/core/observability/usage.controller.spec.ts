import { BadRequestException } from '@nestjs/common';
import { UsageController } from './usage.controller';
import { UsageService, CreateUsageEventDto } from './usage.service';

/**
 * Covers the contract change: `workspaceId` is now required, with no
 * resolution from `brandId` on the api's side. That resolution used to reach
 * into module:content's Brand model from a platform-wide observability
 * endpoint; it is cut deliberately rather than carried forward, since its only
 * callers — flownaŭ and nauthenticity — have no active users (2026-08-30).
 */
describe('UsageController — _service/usage/events', () => {
  let controller: UsageController;
  let service: jest.Mocked<Pick<UsageService, 'record'>>;

  const baseDto: CreateUsageEventDto = {
    workspaceId: 'ws-1',
    service: 'flownau',
    operation: 'generate',
  };

  beforeEach(() => {
    service = { record: jest.fn().mockResolvedValue({ id: 'evt-1' }) };
    controller = new UsageController(service as unknown as UsageService);
  });

  it('records an event that already carries workspaceId', async () => {
    await controller.recordEvent(baseDto);
    expect(service.record).toHaveBeenCalledWith(baseDto);
  });

  it('rejects a request with no workspaceId, rather than resolving one', async () => {
    const { workspaceId: _drop, ...rest } = baseDto;
    await expect(
      controller.recordEvent(rest as unknown as CreateUsageEventDto),
    ).rejects.toThrow(BadRequestException);
    expect(service.record).not.toHaveBeenCalled();
  });

  it('rejects even when brandId is present — brandId no longer substitutes for it', async () => {
    // This is the exact shape flownaŭ's old caller sent: no workspaceId,
    // relying on the api to resolve one from brandId via Brand. That lookup is
    // gone; the request must now fail rather than silently resolve.
    const { workspaceId: _drop, ...rest } = baseDto;
    const withBrand = { ...rest, brandId: 'brand-1' } as unknown as CreateUsageEventDto;

    await expect(controller.recordEvent(withBrand)).rejects.toThrow(
      /workspaceId is required/,
    );
  });

  it('still requires service and operation', async () => {
    await expect(
      controller.recordEvent({ workspaceId: 'ws-1' } as CreateUsageEventDto),
    ).rejects.toThrow(/service and operation are required/);
  });
});
