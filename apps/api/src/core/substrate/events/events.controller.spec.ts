import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import type { AccessTokenPayload } from '@nau/types';

describe('EventsController', () => {
  let controller: EventsController;
  let service: EventsService;

  const user = {
    sub: 'user-1',
    workspaceId: 'ws-1',
    role: 'OWNER',
    iat: 0,
    exp: 0,
  } as AccessTokenPayload;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        {
          provide: EventsService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'e1' }),
            findByBlock: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EventsController>(EventsController);
    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call service.create', async () => {
    const dto = { blockId: 'b1', type: 'done' };
    await controller.create(user, dto);
    expect(service.create).toHaveBeenCalledWith(
      user.sub,
      'b1',
      'done',
      undefined,
    );
  });

  it('should call service.findByBlock', async () => {
    await controller.findByBlock(user, 'b1');
    expect(service.findByBlock).toHaveBeenCalledWith(user.sub, 'b1');
  });
});
