import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { AuthService } from '../auth/auth-service.js';
import { asyncRoute } from '../http/async-route.js';
import { ChatService } from '../chat/chat-service.js';

const conversationId = z.string().length(64).regex(/^[a-f0-9]+$/);
const clientMessageId = z.string().uuid();
const uploadBody = z.object({
  byteSize: z.number().int().positive().max(5 * 1024 * 1024),
  clientMessageId,
  contentType: z.string().min(1).max(160),
  conversationId,
  durationMs: z.number().int().min(1).max(5 * 60 * 1_000).optional(),
  fileName: z.string().min(1).max(255),
}).strict();

function bearerToken(request: Request): string {
  const [scheme, token] = (request.header('authorization') ?? '').split(' ', 2);
  return scheme?.toLowerCase() === 'bearer' ? token ?? '' : '';
}

export function createMediaRouter(authService: AuthService, chatService: ChatService): Router {
  const router = Router();
  router.use(
    asyncRoute(async (request, _response, next) => {
      request.authenticatedPublicId = (await authService.getUser(bearerToken(request))).publicId;
      next();
    }),
  );
  router.post(
    '/uploads',
    rateLimit({ legacyHeaders: false, limit: 30, standardHeaders: 'draft-8', windowMs: 60 * 1_000 }),
    asyncRoute(async (request, response) => {
      const body = uploadBody.parse(request.body);
      response.status(201).json({ upload: await chatService.createUpload(request.authenticatedPublicId, body) });
    }),
  );
  return router;
}

declare global {
  namespace Express {
    interface Request {
      authenticatedPublicId: string;
    }
  }
}
