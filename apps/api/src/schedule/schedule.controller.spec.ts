import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AccessTokenPayload } from '@nau/types';

describe('ScheduleController', () => {
  let controller: ScheduleController;
  let service: ScheduleService;

  const user = {
    sub: 'user-1',
    workspaceId: 'ws-1',
    role: 'OWNER',
    iat: 0,
    exp: 0,
  } as AccessTokenPayload;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScheduleController],
      providers: [
        {
          provide: ScheduleService,
          useValue: {
            upsert: jest.fn().mockResolvedValue({ id: 'sch-1' }),
            findOne: jest.fn().mockResolvedValue({ id: 'sch-1' }),
            remove: jest.fn().mockResolvedValue({ id: 'sch-1' }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ScheduleController>(ScheduleController);
    service = module.get<ScheduleService>(ScheduleService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call service.upsert', async () => {
    const date = new Date().toISOString();
    const dto = { blockId: 'b1', startDate: date as unknown as Date };
    await controller.upsert(user, dto);
    expect(service.upsert).toHaveBeenCalledWith(
      user.sub,
      'b1',
      expect.any(Date),
      undefined,
      undefined,
    );
  });

  it('should call service.findOne', async () => {
    await controller.findOne(user, 'b1');
    expect(service.findOne).toHaveBeenCalledWith(user.sub, 'b1');
  });

  it('should call service.remove', async () => {
    await controller.remove(user, 'sch-1');
    expect(service.remove).toHaveBeenCalledWith(user.sub, 'sch-1');
  });
});
