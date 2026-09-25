import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { AuthService } from '../auth/auth-service.js';
import { G000ST_ID_LENGTH } from '../core/identity.js';
import { asyncRoute } from '../http/async-route.js';
import { ContactsService } from './contacts-service.js';

const publicId = z.string().length(G000ST_ID_LENGTH).regex(/^[A-Za-z0-9]+$/);
const addContactBody = z.object({ publicId }).strict();
const nicknameBody = z.object({ nickname: z.string().trim().max(80).optional() }).strict();

function bearerToken(request: Request): string {
  const [scheme, token] = (request.header('authorization') ?? '').split(' ', 2);
  return scheme?.toLowerCase() === 'bearer' ? token ?? '' : '';
}

function limiter(limit: number) {
  return rateLimit({ legacyHeaders: false, limit, standardHeaders: 'draft-8', windowMs: 60_000 });
}

export function createContactsRouter(authService: AuthService, service: ContactsService): Router {
  const router = Router();
  router.use(asyncRoute(async (request, _response, next) => {
    request.authenticatedPublicId = (await authService.getUser(bearerToken(request))).publicId;
    next();
  }));

  router.get('/', asyncRoute(async (request, response) => {
    response.json({ items: await service.listContacts(request.authenticatedPublicId) });
  }));
  router.post('/', limiter(20), asyncRoute(async (request, response) => {
    await service.addContact(request.authenticatedPublicId, addContactBody.parse(request.body).publicId);
    response.status(201).json({ ok: true });
  }));
  router.delete('/:publicId', limiter(30), asyncRoute(async (request, response) => {
    await service.removeContact(request.authenticatedPublicId, publicId.parse(request.params.publicId));
    response.status(204).send();
  }));
  router.patch('/:publicId', limiter(30), asyncRoute(async (request, response) => {
    await service.updateNickname(request.authenticatedPublicId, publicId.parse(request.params.publicId), nicknameBody.parse(request.body).nickname);
    response.json({ ok: true });
  }));

  return router;
}
