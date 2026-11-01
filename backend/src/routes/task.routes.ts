import { Router } from 'express';
import {
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
} from '../controllers/task.controller';
import { validateRequest } from '../middlewares/validate.middleware';
import { requireAuth } from '../middlewares/auth.middleware';
import { CreateTaskInputSchema, UpdateTaskInputSchema } from '@lifesynch/shared';

const router = Router();

// Protect all task endpoints with requireAuth
router.use(requireAuth);

// GET /api/v1/tasks
router.get('/', listTasks);

// GET /api/v1/tasks/:id
router.get('/:id', getTaskById);

// POST /api/v1/tasks
router.post(
  '/',
  validateRequest({ body: CreateTaskInputSchema }),
  createTask
);

// PATCH /api/v1/tasks/:id
router.patch(
  '/:id',
  validateRequest({ body: UpdateTaskInputSchema }),
  updateTask
);

// DELETE /api/v1/tasks/:id
router.delete('/:id', deleteTask);

export default router;
