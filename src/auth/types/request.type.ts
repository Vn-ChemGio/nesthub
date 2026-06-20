import type { Request } from 'express';
import type { AuthenticatedUser } from '../interfaces';

export interface AuthRequest extends Request {
  user: AuthenticatedUser;
}
