import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { BootstrapDto, LoginDto } from './auth.dto';
import { AUTH_COOKIE_NAME } from './auth.constants';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Sign in (returns JWT; also sets httpOnly cookie when applicable)' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.auth.login(dto.email, dto.password);
    const maxAgeSec = parseInt(process.env.AUTH_COOKIE_MAX_AGE_SEC || '604800', 10);
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: maxAgeSec * 1000,
      path: '/',
    });
    return { token, user };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Clear session cookie' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Current user' })
  async me(@Req() req: { user: { userId: string } }) {
    return this.auth.me(req.user.userId);
  }

  @Post('bootstrap')
  @ApiOperation({
    summary: 'One-time first admin bootstrap (requires BOOTSTRAP_TOKEN env; only when no users exist)',
  })
  async bootstrap(
    @Body() dto: BootstrapDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.auth.bootstrapFirstAdmin(
      dto.email,
      dto.password,
      dto.name,
      dto.bootstrapToken,
    );
    const maxAgeSec = parseInt(process.env.AUTH_COOKIE_MAX_AGE_SEC || '604800', 10);
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: maxAgeSec * 1000,
      path: '/',
    });
    return { token, user };
  }
}
