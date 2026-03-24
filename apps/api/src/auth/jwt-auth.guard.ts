import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AUTH_COOKIE_NAME, IS_PUBLIC_KEY } from './auth.constants';

function extractBearer(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return undefined;
}

function extractCookie(
  req: Request & { cookies?: Record<string, string> },
): string | undefined {
  const c = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof c === 'string' && c.length) return c;
  return undefined;
}

/**
 * Validates JWT from `Authorization: Bearer` or httpOnly cookie `AUTH_COOKIE_NAME`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<
      Request & { user?: { userId: string; email: string; role: string } }
    >();
    const token = extractBearer(req) || extractCookie(req);
    if (!token) {
      throw new UnauthorizedException('Missing authentication');
    }
    let payload: { sub: string };
    try {
      payload = this.auth.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const user = await this.auth.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }
    req.user = user;
    return true;
  }
}
