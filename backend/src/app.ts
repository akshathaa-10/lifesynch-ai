import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env';
import apiRouter from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { logger } from './utils/logger';

export const createApp = (): Application => {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: (origin, callback) => {
        const allowed = [env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000'].filter(Boolean);
        if (!origin || allowed.includes(origin) || origin.startsWith('chrome-extension://')) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request Logging
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.originalUrl}`);
    next();
  });

  // Base API v1 Route
  app.use('/api/v1', apiRouter);

  // Fallback 404 Route
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      timestamp: new Date().toISOString()
    });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
