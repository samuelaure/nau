import { Test, TestingModule } from '@nestjs/testing';
import { RelationsController } from './relations.controller';
import { RelationsService } from './relations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AccessTokenPayload } from '@nau/types';

describe('RelationsController', () => {
  let controller: RelationsController;
  let service: RelationsService;

  const user = {
    sub: 'user-1',
    workspaceId: 'ws-1',
    role: 'OWNER',
    iat: 0,
    exp: 0,
  } as AccessTokenPayload;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RelationsController],
      providers: [
        {
          provide: RelationsService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'rel-1' }),
            remove: jest.fn().mockResolvedValue({ id: 'rel-1' }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RelationsController>(RelationsController);
    service = module.get<RelationsService>(RelationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call service.create', async () => {
    const dto = { fromBlockId: 'b1', toBlockId: 'b2', type: 'link' };
    await controller.create(user, dto);
    expect(service.create).toHaveBeenCalledWith(
      user.sub,
      'b1',
      'b2',
      'link',
      undefined,
    );
  });

  it('should call service.remove', async () => {
    await controller.remove(user, 'rel-1');
    expect(service.remove).toHaveBeenCalledWith(user.sub, 'rel-1');
  });
});
