import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '../http/api-error.js';

declare global {
  namespace Express {
    interface Request {
      authenticatedRole: string;
    }
  }
}

export function requireAdminRole(request: Request, _response: Response, next: NextFunction): void {
  if (request.authenticatedRole !== 'admin') {
    next(new ApiError(403, 'ADMIN_REQUIRED', 'Administrator access is required.'));
    return;
  }

  next();
}
