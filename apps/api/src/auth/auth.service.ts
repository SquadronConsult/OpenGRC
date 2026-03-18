import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  isLocalMode(): boolean {
    return true;
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

  async ensureSeedAdmin() {
    const count = await this.users.count();
    if (count > 0) return;
    const user = this.users.create({
      email: (process.env.SEED_ADMIN_EMAIL || 'admin@localhost').toLowerCase(),
      passwordHash: 'single-user-local-auth-disabled',
      name: 'Local User',
      role: 'admin',
    });
    await this.users.save(user);
  }
}
