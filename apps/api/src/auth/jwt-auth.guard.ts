import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly auth: AuthService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.auth.isLocalMode()) {
      const req = context.switchToHttp().getRequest();
      req.user = await this.auth.getLocalUserContext();
      return true;
    }
    const result = await super.canActivate(context);
    return !!result;
  }
}
