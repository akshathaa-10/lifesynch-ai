import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import taskRoutes from './task.routes';
import syncRoutes from './sync.routes';
import reminderRoutes from './reminder.routes';
import assistantRoutes from './assistant.routes';

const apiRouter = Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/tasks', taskRoutes);
apiRouter.use('/sync', syncRoutes);
apiRouter.use('/reminders', reminderRoutes);
apiRouter.use('/assistant', assistantRoutes);

export default apiRouter;
