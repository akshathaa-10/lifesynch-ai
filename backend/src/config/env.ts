import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { z } from 'zod';

// Determine backend/.env path deterministically using source file location
const backendEnvPath = path.resolve(__dirname, '../../.env');
const rootEnvPath = path.resolve(__dirname, '../../../.env');

// Establish backend/.env as the primary source of truth for backend configuration
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath, override: true });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath, override: true });
} else {
  dotenv.config();
}

const cleanString = (val?: string) => {
  if (typeof val !== 'string') return '';
  return val.replace(/^["']|["']$/g, '').trim();
};

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().transform(cleanString).default('http://localhost:5173'),

  JWT_SECRET: z.string().transform(cleanString).default('lifesynch-dev-secret-key-change-in-prod-12345'),

  SUPABASE_URL: z.string().transform(cleanString).default(''),
  SUPABASE_ANON_KEY: z.string().transform(cleanString).default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().transform(cleanString).default(''),

  GOOGLE_CLIENT_ID: z.string().transform(cleanString).default(''),
  GOOGLE_CLIENT_SECRET: z.string().transform(cleanString).default(''),
  GOOGLE_REDIRECT_URI: z.string().transform(cleanString).default('http://localhost:5000/api/v1/auth/google/callback'),

  LLM_PROVIDER: z.enum(['gemini', 'openai', 'groq']).default('gemini'),
  LLM_API_KEY: z.string().transform(cleanString).default(''),
  LLM_MODEL: z.string().transform(cleanString).default('gemini-flash-lite-latest'),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

export const REQUIRED_BACKEND_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'JWT_SECRET',
  'CLIENT_URL',
  'PORT'
] as const;

export type RequiredBackendEnvVar = typeof REQUIRED_BACKEND_ENV_VARS[number];

export interface EnvValidationResult {
  valid: boolean;
  missing: RequiredBackendEnvVar[];
}

export const validateRequiredEnv = (envData: Record<string, any> = env): EnvValidationResult => {
  const missing: RequiredBackendEnvVar[] = [];
  for (const varName of REQUIRED_BACKEND_ENV_VARS) {
    const val = envData[varName];
    if (val === undefined || val === null || (typeof val === 'string' && val.trim().length === 0)) {
      missing.push(varName);
    }
  }
  return {
    valid: missing.length === 0,
    missing
  };
};

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variable format:', result.error.format());
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();

