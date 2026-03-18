import { Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() b: { email: string; password: string }) {
    return this.auth.login(b.email, b.password);
  }

  @Post('register')
  register(
    @Body()
    b: { email: string; password: string; name?: string },
  ) {
    if (this.auth.isLocalMode()) {
      throw new ForbiddenException('Registration disabled in local mode');
    }
    if (process.env.DISABLE_PUBLIC_REGISTER === 'true') {
      throw new ForbiddenException('Registration disabled');
    }
    return this.auth.register(b.email, b.password, b.name);
  }
}
