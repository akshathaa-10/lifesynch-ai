import { Router } from 'express';
import {
  listReminders,
  generateReminders,
  markReminderAsRead,
  markAllRemindersAsRead
} from '../controllers/reminder.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Protect all reminder endpoints with requireAuth
router.use(requireAuth);

// GET /api/v1/reminders
router.get('/', listReminders);

// POST /api/v1/reminders/generate
router.post('/generate', generateReminders);

// PATCH /api/v1/reminders/read-all
router.patch('/read-all', markAllRemindersAsRead);

// PATCH /api/v1/reminders/:id/read
router.patch('/:id/read', markReminderAsRead);

export default router;
