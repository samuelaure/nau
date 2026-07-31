import { Test, TestingModule } from '@nestjs/testing';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';
import { Block } from '@prisma/client';
import { CreateBlockDto } from './dto/create-block.dto';
import { UpdateBlockDto } from './dto/update-block.dto';
import { FindBlocksQueryDto } from './dto/find-blocks-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AccessTokenPayload } from '@nau/types';

describe('BlocksController', () => {
  let controller: BlocksController;
  let service: BlocksService;

  const user = {
    sub: 'user-1',
    workspaceId: 'ws-1',
    role: 'OWNER',
    iat: 0,
    exp: 0,
  } as AccessTokenPayload;

  const mockBlock = {
    id: 'block-1',
    type: 'note',
    properties: { text: 'Test note' },
    parentId: null,
    uuid: 'uuid-1',
    deletedAt: null,
    source: null,
    sourceRef: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Block;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlocksController],
      providers: [
        {
          provide: BlocksService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            findOne: jest.fn(),
            getRemindableBlocks: jest.fn(),
            addTag: jest.fn(),
            removeTag: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BlocksController>(BlocksController);
    service = module.get<BlocksService>(BlocksService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call blocksService.create with the caller and the DTO', async () => {
      const createDto: CreateBlockDto = { type: 'note', properties: {} };
      jest.spyOn(service, 'create').mockResolvedValue(mockBlock as any);
      await controller.create(user, createDto);
      expect(service.create).toHaveBeenCalledWith(user, createDto);
    });
  });

  describe('findAll', () => {
    it('should scope the query to the calling user', async () => {
      const queryDto: FindBlocksQueryDto = { type: 'note' };
      jest.spyOn(service, 'findAll').mockResolvedValue([mockBlock] as any);
      await controller.findAll(user, queryDto);
      expect(service.findAll).toHaveBeenCalledWith(user.sub, queryDto);
    });
  });

  describe('update', () => {
    it('should call blocksService.update with the caller, ID and DTO', async () => {
      const updateDto: UpdateBlockDto = { properties: { text: 'updated' } };
      jest.spyOn(service, 'update').mockResolvedValue(mockBlock as any);
      await controller.update(user, 'block-1', updateDto);
      expect(service.update).toHaveBeenCalledWith(user.sub, 'block-1', updateDto);
    });
  });

  describe('remove', () => {
    it('should call blocksService.remove with the caller and ID', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue(mockBlock as any);
      await controller.remove(user, 'block-1');
      expect(service.remove).toHaveBeenCalledWith(user.sub, 'block-1');
    });
  });

  describe('findOne', () => {
    it('should call blocksService.findOne with the caller and ID', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockBlock as any);
      await controller.findOne(user, 'block-1');
      expect(service.findOne).toHaveBeenCalledWith(user.sub, 'block-1');
    });
  });

  describe('getRemindableBlocks', () => {
    it('should scope remindable blocks to the calling user', async () => {
      jest
        .spyOn(service, 'getRemindableBlocks')
        .mockResolvedValue([mockBlock] as any);
      await controller.getRemindableBlocks(user);
      expect(service.getRemindableBlocks).toHaveBeenCalledWith(user.sub);
    });
  });

  describe('tags', () => {
    it('should scope addTag to the calling user', async () => {
      jest.spyOn(service, 'addTag').mockResolvedValue({} as any);
      await controller.addTag(user, 'block-1', 'tag-1');
      expect(service.addTag).toHaveBeenCalledWith(user.sub, 'block-1', 'tag-1');
    });

    it('should scope removeTag to the calling user', async () => {
      jest.spyOn(service, 'removeTag').mockResolvedValue({} as any);
      await controller.removeTag(user, 'block-1', 'tag-1');
      expect(service.removeTag).toHaveBeenCalledWith(
        user.sub,
        'block-1',
        'tag-1',
      );
    });
  });
});
