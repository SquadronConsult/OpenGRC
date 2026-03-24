import type { Request } from 'express';

/** JWT-authenticated user attached to `req.user` by JwtAuthGuard. */
export type RequestUser = {
  userId: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
};

/** Express request on routes protected by JwtAuthGuard (`user` is always set). */
export type AuthenticatedRequest = Request & { user: RequestUser };

export type JwtAccessPayload = {
  sub: string;
  email: string;
  role: string;
  typ: 'access';
};
