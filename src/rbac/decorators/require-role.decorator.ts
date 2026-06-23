import { SetMetadata } from '@nestjs/common';

export const REQUIRED_ROLE_KEY = 'required_role';
export const RequireRole = (...roles: string[]) =>
  SetMetadata(REQUIRED_ROLE_KEY, roles);
