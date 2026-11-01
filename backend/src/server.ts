import { createApp } from './app';
import { env, validateRequiredEnv } from './config/env';
import { isSupabaseConfigured } from './config/supabase';
import { logger } from './utils/logger';

// Validate required environment variables safely without printing any values
const validation = validateRequiredEnv();
if (!validation.valid) {
  logger.warn(`⚠ Missing or empty required environment variable(s): ${validation.missing.join(', ')}`);
} else {
  logger.info('✔ Environment validation passed: All required configuration variables are present.');
}

const app = createApp();

import { autoSyncService } from './services/auto-sync.service';

const server = app.listen(env.PORT, () => {
  const supabaseConfigured = isSupabaseConfigured();
  logger.info(`=======================================================`);
  logger.info(`🚀 LifeSynch AI Backend running on port ${env.PORT}`);
  logger.info(`📡 Environment: ${env.NODE_ENV}`);
  logger.info(`🔍 Health check: http://localhost:${env.PORT}/api/v1/health`);
  logger.info(`🔗 Client URL: ${env.CLIENT_URL}`);
  logger.info(`🗄  DATABASE CONNECTION: ${supabaseConfigured ? 'CONNECTED (Supabase)' : 'UNCONFIGURED'}`);
  logger.info(`🛡  IN-MEMORY FALLBACK: ${supabaseConfigured ? 'DISABLED' : 'ENABLED'}`);
  logger.info(`🔄  AUTOMATIC SYNC: ACTIVE (30s interval)`);
  logger.info(`=======================================================`);

  // Start periodic automatic sync
  autoSyncService.start(30000);
});


const handleShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  autoSyncService.stop();
  server.close(() => {
    logger.info('HTTP server closed. Exiting process.');
    process.exit(0);
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default server;
