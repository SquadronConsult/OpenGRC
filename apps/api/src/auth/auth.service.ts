import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { JwtAccessPayload } from './auth.types';
import { LEGACY_DISABLED_PASSWORD_PLACEHOLDER } from './auth.constants';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  isLocalMode(): boolean {
    return process.env.AUTH_MODE === 'local_single_operator';
  }

  /** @deprecated Legacy single-operator bootstrap; prefer JWT login. */
  async getLocalUserContext() {
    return this.getOperatorContext();
  }

  /**
   * Legacy compatibility: only when AUTH_MODE=local_single_operator.
   * Otherwise callers must use JWT auth.
   */
  async getOperatorContext(): Promise<{
    userId: string;
    email: string;
    role: string;
    mode: 'local_single_operator';
  }> {
    if (!this.isLocalMode()) {
      throw new UnauthorizedException('Local operator mode disabled; sign in required');
    }
    const email = (process.env.SEED_ADMIN_EMAIL || 'admin@localhost').toLowerCase();
    let user = await this.users.findOne({ where: { email } });
    if (!user) {
      await this.ensureSeedAdmin();
      user = await this.users.findOne({ where: { email } });
    }
    if (!user) {
      throw new UnauthorizedException('Local user bootstrap failed');
    }
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      mode: 'local_single_operator',
    };
  }

  /**
   * When the database has no users, creates the initial admin from
   * `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (≥8 chars).
   * The user must change this password on first login (`mustChangePassword`).
   */
  async ensureSeedAdmin() {
    const count = await this.users.count();
    if (count > 0) return;
    const pwd = process.env.SEED_ADMIN_PASSWORD;
    if (!pwd || pwd.length < 8) {
      if (pwd != null && pwd.length > 0 && pwd.length < 8) {
        this.logger.warn(
          'SEED_ADMIN_PASSWORD is set but must be at least 8 characters; skipping initial admin seed.',
        );
      }
      return;
    }
    const email = (process.env.SEED_ADMIN_EMAIL || 'admin@localhost').toLowerCase();
    const hash = await bcrypt.hash(pwd, BCRYPT_ROUNDS);
    const user = this.users.create({
      email,
      passwordHash: hash,
      name: 'Administrator',
      role: 'admin',
      isActive: true,
      passwordSetAt: new Date(),
      authProvider: 'local',
      mustChangePassword: true,
    });
    await this.users.save(user);
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  signAccessToken(user: User): string {
    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      typ: 'access',
    };
    return this.jwt.sign(payload);
  }

  verifyAccessToken(token: string): JwtAccessPayload {
    return this.jwt.verify<JwtAccessPayload>(token);
  }

  private lockoutMaxAttempts(): number {
    const n = parseInt(process.env.AUTH_LOCKOUT_MAX_ATTEMPTS || '5', 10);
    return Number.isFinite(n) && n > 0 ? n : 5;
  }

  /** Exponential lock duration after crossing the threshold (attempts >= N). */
  private computeLockDurationSeconds(attempts: number, threshold: number): number {
    const base = parseInt(process.env.AUTH_LOCKOUT_BASE_SEC || '60', 10);
    const maxSec = parseInt(process.env.AUTH_LOCKOUT_MAX_SEC || '900', 10);
    const b = Number.isFinite(base) && base > 0 ? base : 60;
    const cap = Number.isFinite(maxSec) && maxSec > 0 ? maxSec : 900;
    const tier = Math.max(0, attempts - threshold);
    return Math.min(cap, b * Math.pow(2, tier));
  }

  async validateUser(
    userId: string,
  ): Promise<{ userId: string; email: string; role: string; mustChangePassword: boolean } | null> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || !user.isActive) return null;
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  }

  /**
   * First active admin — used when `INTEGRATION_API_KEY` is presented as Bearer
   * instead of a JWT (MCP / automation).
   */
  async getIntegrationActorUser(): Promise<{
    userId: string;
    email: string;
    role: string;
  } | null> {
    const user = await this.users.findOne({
      where: { isActive: true, role: 'admin' },
      order: { createdAt: 'ASC' },
    });
    if (!user) return null;
    return { userId: user.id, email: user.email, role: user.role };
  }

  async login(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    const threshold = this.lockoutMaxAttempts();
    const user = await this.users.findOne({ where: { email: normalized } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.authProvider && user.authProvider !== 'local') {
      throw new UnauthorizedException('Use SSO for this account');
    }
    const ok = await this.verifyPassword(password, user.passwordHash);
    if (!ok) {
      const prev = user.failedLoginAttempts ?? 0;
      user.failedLoginAttempts = prev + 1;
      if (user.failedLoginAttempts >= threshold) {
        const sec = this.computeLockDurationSeconds(user.failedLoginAttempts, threshold);
        user.lockedUntil = new Date(now.getTime() + sec * 1000);
      }
      await this.users.save(user);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.passwordHash === LEGACY_DISABLED_PASSWORD_PLACEHOLDER) {
      throw new UnauthorizedException('Set a real password for this account');
    }
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await this.users.save(user);
    const token = this.signAccessToken(user);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    if (user.authProvider && user.authProvider !== 'local') {
      throw new BadRequestException('Password change is not available for this account');
    }
    const ok = await this.verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    user.passwordHash = await this.hashPassword(newPassword);
    user.passwordSetAt = new Date();
    user.mustChangePassword = false;
    await this.users.save(user);
    const token = this.signAccessToken(user);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mustChangePassword: false,
      },
    };
  }

  async me(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      authProvider: user.authProvider,
      lastLoginAt: user.lastLoginAt,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
