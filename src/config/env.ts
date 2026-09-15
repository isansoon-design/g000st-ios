import { z } from 'zod';

const envSchema = z.object({
  AUTH_COLLECTION_PREFIX: z.string().regex(/^[a-z0-9_]+$/i).default('staging_v1'),
  AUTH_RECOVERY_PEPPER: z.string().min(32),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().min(1),
  HOST: z.string().default('127.0.0.1'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3100),
});

export type ApiEnvironment = Readonly<{
  allowedOrigins: readonly string[];
  collectionPrefix: string;
  firebaseServiceAccountPath: string;
  host: string;
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  recoveryPepper: string;
}>;

export function readEnvironment(source: NodeJS.ProcessEnv = process.env): ApiEnvironment {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.') || 'environment');
    throw new Error(`Invalid API environment fields: ${[...new Set(fields)].join(', ')}`);
  }

  return {
    allowedOrigins: result.data.CORS_ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    collectionPrefix: result.data.AUTH_COLLECTION_PREFIX,
    firebaseServiceAccountPath: result.data.FIREBASE_SERVICE_ACCOUNT_PATH,
    host: result.data.HOST,
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    recoveryPepper: result.data.AUTH_RECOVERY_PEPPER,
  };
}
