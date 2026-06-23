import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (action: string, resource: string) =>
  SetMetadata(PERMISSIONS_KEY, { action, resource });
