import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RequestUser } from './auth.types';
import { AUTH_COOKIE_NAME, IS_PUBLIC_KEY } from './auth.constants';

/** Routes still allowed while `mustChangePassword` is true (password rotation flow). */
function isAllowedWhenMustChangePassword(method: string, path: string): boolean {
  const p = path.split('?')[0];
  if (method === 'POST' && p === '/auth/logout') return true;
  if (method === 'POST' && p === '/auth/change-password') return true;
  if (method === 'GET' && p === '/auth/me') return true;
  return false;
}

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
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<
      Request & { user?: RequestUser }
    >();
    const token = extractBearer(req) || extractCookie(req);
    if (!token) {
      throw new UnauthorizedException('Missing authentication');
    }
    const integrationKey = this.config.get<string>('INTEGRATION_API_KEY');
    if (integrationKey?.length && token === integrationKey) {
      const actor = await this.auth.getIntegrationActorUser();
      if (!actor) {
        throw new UnauthorizedException(
          'Integration key configured but no admin user exists',
        );
      }
      req.user = { ...actor, mustChangePassword: false };
      return true;
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
    const raw = context.switchToHttp().getRequest<Request>();
    const path = raw.path || raw.url?.split('?')[0] || '';
    if (
      user.mustChangePassword &&
      !isAllowedWhenMustChangePassword(raw.method || 'GET', path)
    ) {
      throw new ForbiddenException(
        'You must change your password before using the API',
      );
    }
    return true;
  }
}
