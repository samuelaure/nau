import { Router } from 'express';
import { ConfigController } from './config.controller.js';

const router = Router();

router.get('/keywords', ConfigController.getKeywords);
router.post('/keywords', ConfigController.addKeyword);
router.delete('/keywords/:id', ConfigController.deleteKeyword);

router.get('/global', ConfigController.getConfig);
router.patch('/global', ConfigController.updateConfig);

export default router;
