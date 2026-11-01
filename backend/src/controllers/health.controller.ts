import { Request, Response } from 'express';
import { env } from '../config/env';
import { isSupabaseConfigured } from '../config/supabase';
import { ApiResponse, HealthCheckData } from '@lifesynch/shared';

export const getHealth = (_req: Request, res: Response): void => {
  const healthData: HealthCheckData = {
    status: 'ok',
    version: '0.1.0',
    uptime: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
    services: {
      database: isSupabaseConfigured() ? 'connected' : 'unconfigured',
      googleAuth: env.GOOGLE_CLIENT_ID ? 'configured' : 'unconfigured',
      llm: env.LLM_API_KEY ? 'configured' : 'unconfigured'
    }
  };

  const response: ApiResponse<HealthCheckData> = {
    success: true,
    message: 'LifeSynch AI Backend is operational',
    data: healthData,
    timestamp: new Date().toISOString()
  };

  res.status(200).json(response);
};
