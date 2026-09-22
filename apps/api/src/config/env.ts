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
  STRIPE_CHECKOUT_CANCEL_URL_MOBILE: z.string().min(1).optional(),
  STRIPE_CHECKOUT_CANCEL_URL_WEB: z.url().optional(),
  STRIPE_CHECKOUT_SUCCESS_URL_MOBILE: z.string().min(1).optional(),
  STRIPE_CHECKOUT_SUCCESS_URL_WEB: z.url().optional(),
  APNS_VOIP_BUNDLE_ID: z.string().min(1).optional(),
  APNS_VOIP_KEY_ID: z.string().min(1).optional(),
  APNS_VOIP_PRIVATE_KEY: z.string().min(1).optional(),
  APNS_VOIP_PRODUCTION: z.enum(['true', 'false']).optional(),
  APNS_VOIP_TEAM_ID: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  TELNYX_API_KEY: z.string().min(1).optional(),
  TELNYX_CONNECTION_ID: z.string().min(1).optional(),
  TELNYX_PUBLIC_KEY: z.string().min(1).optional(),
  TELNYX_SHARED_NUMBER_E164: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
  TURN_SHARED_SECRET: z.string().min(1).optional(),
  TURN_URLS: z.string().min(1).optional(),
});

export type ApiEnvironment = Readonly<{
  allowedOrigins: readonly string[];
  apnsVoip?: Readonly<{
    bundleId: string;
    keyId: string;
    privateKeyPem: string;
    production: boolean;
    teamId: string;
  }>;
  billing?: Readonly<{
    checkoutUrls: Readonly<{
      mobile: Readonly<{ successUrl: string; cancelUrl: string }>;
      web: Readonly<{ successUrl: string; cancelUrl: string }>;
    }>;
    stripeSecretKey: string;
    stripeWebhookSecret: string;
  }>;
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
  telephony?: Readonly<{
    telnyxApiKey: string;
    telnyxConnectionId: string;
    telnyxPublicKey: string;
    telnyxSharedNumberE164: string;
  }>;
  turn?: Readonly<{ sharedSecret: string; urls: readonly string[] }>;
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

  const billingValues = [
    result.data.STRIPE_SECRET_KEY,
    result.data.STRIPE_WEBHOOK_SECRET,
    result.data.STRIPE_CHECKOUT_SUCCESS_URL_MOBILE,
    result.data.STRIPE_CHECKOUT_CANCEL_URL_MOBILE,
    result.data.STRIPE_CHECKOUT_SUCCESS_URL_WEB,
    result.data.STRIPE_CHECKOUT_CANCEL_URL_WEB,
  ];
  const hasAnyBillingValue = billingValues.some(Boolean);
  const hasCompleteBillingConfig = billingValues.every(Boolean);
  if (hasAnyBillingValue && !hasCompleteBillingConfig) {
    throw new Error('Invalid API environment fields: incomplete billing/Stripe configuration');
  }

  const telephonyValues = [
    result.data.TELNYX_API_KEY,
    result.data.TELNYX_PUBLIC_KEY,
    result.data.TELNYX_CONNECTION_ID,
    result.data.TELNYX_SHARED_NUMBER_E164,
  ];
  const hasAnyTelephonyValue = telephonyValues.some(Boolean);
  const hasCompleteTelephonyConfig = telephonyValues.every(Boolean);
  if (hasAnyTelephonyValue && !hasCompleteTelephonyConfig) {
    throw new Error('Invalid API environment fields: incomplete Telnyx telephony configuration');
  }
  if (hasCompleteTelephonyConfig && !hasCompleteBillingConfig) {
    throw new Error('Invalid API environment fields: telephony configuration requires billing/Stripe to also be configured');
  }

  const turnValues = [result.data.TURN_SHARED_SECRET, result.data.TURN_URLS];
  const hasAnyTurnValue = turnValues.some(Boolean);
  const hasCompleteTurnConfig = turnValues.every(Boolean);
  if (hasAnyTurnValue && !hasCompleteTurnConfig) {
    throw new Error('Invalid API environment fields: incomplete TURN configuration');
  }

  const apnsVoipValues = [
    result.data.APNS_VOIP_KEY_ID,
    result.data.APNS_VOIP_TEAM_ID,
    result.data.APNS_VOIP_PRIVATE_KEY,
    result.data.APNS_VOIP_BUNDLE_ID,
  ];
  const hasAnyApnsVoipValue = apnsVoipValues.some(Boolean);
  const hasCompleteApnsVoipConfig = apnsVoipValues.every(Boolean);
  if (hasAnyApnsVoipValue && !hasCompleteApnsVoipConfig) {
    throw new Error('Invalid API environment fields: incomplete APNs VoIP configuration');
  }

  return {
    allowedOrigins: result.data.CORS_ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    ...(hasCompleteApnsVoipConfig
      ? {
          apnsVoip: {
            bundleId: result.data.APNS_VOIP_BUNDLE_ID!,
            keyId: result.data.APNS_VOIP_KEY_ID!,
            // .env files commonly store a multi-line PEM with literal "\n" escapes.
            privateKeyPem: result.data.APNS_VOIP_PRIVATE_KEY!.replace(/\\n/g, '\n'),
            production: result.data.APNS_VOIP_PRODUCTION === 'true',
            teamId: result.data.APNS_VOIP_TEAM_ID!,
          },
        }
      : {}),
    ...(hasCompleteBillingConfig
      ? {
          billing: {
            checkoutUrls: {
              mobile: {
                successUrl: result.data.STRIPE_CHECKOUT_SUCCESS_URL_MOBILE!,
                cancelUrl: result.data.STRIPE_CHECKOUT_CANCEL_URL_MOBILE!,
              },
              web: {
                successUrl: result.data.STRIPE_CHECKOUT_SUCCESS_URL_WEB!,
                cancelUrl: result.data.STRIPE_CHECKOUT_CANCEL_URL_WEB!,
              },
            },
            stripeSecretKey: result.data.STRIPE_SECRET_KEY!,
            stripeWebhookSecret: result.data.STRIPE_WEBHOOK_SECRET!,
          },
        }
      : {}),
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
    ...(hasCompleteTelephonyConfig
      ? {
          telephony: {
            telnyxApiKey: result.data.TELNYX_API_KEY!,
            telnyxConnectionId: result.data.TELNYX_CONNECTION_ID!,
            telnyxPublicKey: result.data.TELNYX_PUBLIC_KEY!,
            telnyxSharedNumberE164: result.data.TELNYX_SHARED_NUMBER_E164!,
          },
        }
      : {}),
    ...(hasCompleteTurnConfig
      ? {
          turn: {
            sharedSecret: result.data.TURN_SHARED_SECRET!,
            urls: result.data.TURN_URLS!.split(',').map((url) => url.trim()).filter(Boolean),
          },
        }
      : {}),
  };
}
