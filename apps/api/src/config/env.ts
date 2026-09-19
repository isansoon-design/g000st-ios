import { z } from 'zod';

const envSchema = z.object({
  AUTH_COLLECTION_PREFIX: z.string().regex(/^[a-z0-9_]+$/i).default('staging_v1'),
  AUTH_RECOVERY_PEPPER: z.string().min(32),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  EXPO_PUSH_ACCESS_TOKEN: z.string().min(1).optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().min(1),
  HOST: z.string().default('127.0.0.1'),
  MEDIA_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  MEDIA_S3_BUCKET: z.string().min(3).optional(),
  MEDIA_S3_ENDPOINT: z.url().optional(),
  MEDIA_S3_REGION: z.string().min(1).default('us-east-1'),
  MEDIA_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3100),
});

export type ApiEnvironment = Readonly<{
  allowedOrigins: readonly string[];
  collectionPrefix: string;
  expoPushAccessToken?: string;
  firebaseServiceAccountPath: string;
  host: string;
  media?: Readonly<{
    accessKeyId: string;
    bucket: string;
    endpoint: string;
    region: string;
    secretAccessKey: string;
  }>;
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

  const mediaValues = [
    result.data.MEDIA_S3_ACCESS_KEY_ID,
    result.data.MEDIA_S3_BUCKET,
    result.data.MEDIA_S3_ENDPOINT,
    result.data.MEDIA_S3_SECRET_ACCESS_KEY,
  ];
  const hasAnyMediaValue = mediaValues.some(Boolean);
  const hasCompleteMediaConfig = mediaValues.every(Boolean);
  if (hasAnyMediaValue && !hasCompleteMediaConfig) {
    throw new Error('Invalid API environment fields: incomplete media storage configuration');
  }

  return {
    allowedOrigins: result.data.CORS_ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    collectionPrefix: result.data.AUTH_COLLECTION_PREFIX,
    ...(result.data.EXPO_PUSH_ACCESS_TOKEN
      ? { expoPushAccessToken: result.data.EXPO_PUSH_ACCESS_TOKEN }
      : {}),
    firebaseServiceAccountPath: result.data.FIREBASE_SERVICE_ACCOUNT_PATH,
    host: result.data.HOST,
    ...(hasCompleteMediaConfig
      ? {
          media: {
            accessKeyId: result.data.MEDIA_S3_ACCESS_KEY_ID!,
            bucket: result.data.MEDIA_S3_BUCKET!,
            endpoint: result.data.MEDIA_S3_ENDPOINT!,
            region: result.data.MEDIA_S3_REGION,
            secretAccessKey: result.data.MEDIA_S3_SECRET_ACCESS_KEY!,
          },
        }
      : {}),
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    recoveryPepper: result.data.AUTH_RECOVERY_PEPPER,
  };
}
