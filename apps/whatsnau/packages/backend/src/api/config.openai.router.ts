import { Router } from 'express';
import * as controller from './config.openai.controller.js';
import { authMiddleware } from '../core/authMiddleware.js';
import { asyncHandler } from '../core/errors/asyncHandler.js';

export const openAIConfigRouter = Router();

openAIConfigRouter.use(authMiddleware);

openAIConfigRouter.get('/', asyncHandler(controller.getOpenAIConfig));
openAIConfigRouter.post('/', asyncHandler(controller.upsertOpenAIConfig));
openAIConfigRouter.delete('/:id', asyncHandler(controller.deleteOpenAIConfig));
openAIConfigRouter.post('/test', asyncHandler(controller.testOpenAIApiKey));
