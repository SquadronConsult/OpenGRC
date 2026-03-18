import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  isLocalMode(): boolean {
    return (process.env.AUTH_MODE || 'local') !== 'multiuser';
  }

  async getLocalUserContext() {
    const email = (process.env.SEED_ADMIN_EMAIL || 'admin@localhost').toLowerCase();
    let user = await this.users.findOne({ where: { email } });
    if (!user) {
      await this.ensureSeedAdmin();
      user = await this.users.findOne({ where: { email } });
    }
    if (!user) {
      throw new UnauthorizedException('Local user bootstrap failed');
    }
    return { userId: user.id, email: user.email, role: user.role };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.users.findOne({ where: { email: email.toLowerCase() } });
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }

  async login(email: string, password: string) {
    if (this.isLocalMode()) {
      const local = await this.getLocalUserContext();
      return {
        access_token: this.jwt.sign({
          sub: local.userId,
          email: local.email,
          role: local.role,
        }),
        user: { id: local.userId, email: local.email, name: 'Local User', role: local.role },
        mode: 'local',
      };
    }

    const user = await this.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return {
      access_token: this.jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  async register(
    email: string,
    password: string,
    name?: string,
    role: UserRole = 'csp_manager',
  ) {
    if (this.isLocalMode()) {
      throw new UnauthorizedException('Registration is disabled in local mode');
    }
    const hash = await bcrypt.hash(password, 10);
    const u = this.users.create({
      email: email.toLowerCase(),
      passwordHash: hash,
      name,
      role,
    });
    await this.users.save(u);
    return this.login(email, password);
  }

  async ensureSeedAdmin() {
    const count = await this.users.count();
    if (count > 0) return;
    const pass = process.env.SEED_ADMIN_PASSWORD || 'changeme';
    await this.register(
      process.env.SEED_ADMIN_EMAIL || 'admin@localhost',
      pass,
      'Admin',
      'admin',
    );
  }
}
