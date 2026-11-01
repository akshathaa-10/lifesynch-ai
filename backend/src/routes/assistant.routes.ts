import { Router } from 'express';
import { askAssistant } from '../controllers/assistant.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Protect assistant routes with requireAuth
router.use(requireAuth);

// POST /api/v1/assistant/ask
router.post('/ask', askAssistant);

export default router;
