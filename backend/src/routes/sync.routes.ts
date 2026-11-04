import { Router } from 'express';
import { 
  syncGmail, 
  syncCalendar, 
  getSyncStatus, 
  getUserEmails,
  getUserSpamEmails, 
  getUserCalendarEvents,
  syncResponsibilities,
  getUserResponsibilities
} from '../controllers/sync.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Protect all sync endpoints with requireAuth
router.use(requireAuth);

// POST /api/v1/sync/gmail
router.post('/gmail', syncGmail);

// GET /api/v1/sync/emails
router.get('/emails', getUserEmails);
router.get('/spam', getUserSpamEmails);

// POST /api/v1/sync/calendar
router.post('/calendar', syncCalendar);

// GET /api/v1/sync/calendar-events & GET /api/v1/sync/calendar
router.get('/calendar-events', getUserCalendarEvents);
router.get('/calendar', getUserCalendarEvents);

// POST /api/v1/sync/responsibilities (AI Responsibility Generation)
router.post('/responsibilities', syncResponsibilities);

// GET /api/v1/sync/responsibilities
router.get('/responsibilities', getUserResponsibilities);

// GET /api/v1/sync/status
router.get('/status', getSyncStatus);

export default router;
