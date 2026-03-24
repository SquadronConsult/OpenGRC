import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { JwtAccessPayload } from './auth.types';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
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

  /** Creates first admin only when DB is empty and SEED_ADMIN_PASSWORD is set (dev convenience). */
  async ensureSeedAdmin() {
    const count = await this.users.count();
    if (count > 0) return;
    const pwd = process.env.SEED_ADMIN_PASSWORD;
    if (!pwd || pwd.length < 8) {
      return;
    }
    const email = (process.env.SEED_ADMIN_EMAIL || 'admin@localhost').toLowerCase();
    const hash = await bcrypt.hash(pwd, BCRYPT_ROUNDS);
    const user = this.users.create({
      email,
      passwordHash: hash,
      name: 'Seed Admin',
      role: 'admin',
      isActive: true,
      passwordSetAt: new Date(),
      authProvider: 'local',
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

  async validateUser(
    userId: string,
  ): Promise<{ userId: string; email: string; role: string } | null> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || !user.isActive) return null;
    return { userId: user.id, email: user.email, role: user.role };
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
    const user = await this.users.findOne({ where: { email: normalized } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.authProvider && user.authProvider !== 'local') {
      throw new UnauthorizedException('Use SSO for this account');
    }
    const ok = await this.verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.passwordHash === 'single-user-local-auth-disabled') {
      throw new UnauthorizedException('Set a real password or reset bootstrap');
    }
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
      },
    };
  }

  async bootstrapFirstAdmin(
    email: string,
    password: string,
    name: string | undefined,
    bootstrapToken: string,
  ) {
    const expected = process.env.BOOTSTRAP_TOKEN;
    if (!expected?.length) {
      throw new BadRequestException('Bootstrap is disabled (set BOOTSTRAP_TOKEN)');
    }
    if (bootstrapToken !== expected) {
      throw new UnauthorizedException('Invalid bootstrap token');
    }
    const count = await this.users.count();
    if (count > 0) {
      throw new BadRequestException('Bootstrap already completed');
    }
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const normalized = email.trim().toLowerCase();
    const hash = await this.hashPassword(password);
    const user = this.users.create({
      email: normalized,
      passwordHash: hash,
      name: name ?? 'Administrator',
      role: 'admin',
      isActive: true,
      passwordSetAt: new Date(),
      authProvider: 'local',
    });
    await this.users.save(user);
    const token = this.signAccessToken(user);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
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
    };
  }
}
