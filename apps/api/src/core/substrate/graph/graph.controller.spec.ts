import { Test, TestingModule } from '@nestjs/testing';
import { GraphController } from './graph.controller';
import { GraphService } from './graph.service';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import type { AccessTokenPayload } from '@nau/types';

describe('GraphController', () => {
  let controller: GraphController;
  let service: GraphService;

  const user = {
    sub: 'user-1',
    workspaceId: 'ws-1',
    role: 'OWNER',
    iat: 0,
    exp: 0,
  } as AccessTokenPayload;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GraphController],
      providers: [
        {
          provide: GraphService,
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

    controller = module.get<GraphController>(GraphController);
    service = module.get<GraphService>(GraphService);
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
