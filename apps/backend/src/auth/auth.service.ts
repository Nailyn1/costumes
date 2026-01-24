import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { LoginRequestDto } from '@costumes/shared';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

@Injectable()
export class AuthService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  getCookieOptions() {
    return {
      httpOnly: true, // Защита от кражи токена через JS
      secure: process.env.NODE_ENV === 'production', // В продакшене только по HTTPS
      sameSite: 'lax' as const, // Защита от CSRF атак
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
      path: '/', // Кука доступна для всего сайта
    };
  }

  async login(data: LoginRequestDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        login: data.login,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    const isPasswordValid = await argon2.verify(user.password, data.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { accessToken, refreshToken } = await this.issueTokens(
      user.id,
      user.login,
    );

    await this.updateRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: {
        login: user.login,
        name: user.name,
      },
    };
  }

  async refreshTokens(userId: number, oldRefreshToken: string) {
    const savedToken = await this.redis.get(`rf:${userId}`);

    if (!savedToken || savedToken !== oldRefreshToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    const { accessToken, refreshToken } = await this.issueTokens(
      user.id,
      user.login,
    );

    await this.updateRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: {
        login: user.login,
        name: user.name,
      },
    };
  }

  async logout(userId: number) {
    const key = `rf:${userId}`;
    return await this.redis.del(key);
  }

  private async issueTokens(userId: number, login: string) {
    const payload = { id: userId, login };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(userId: number, refreshToken: string) {
    const key = `rf:${userId}`;
    await this.redis.set(key, refreshToken, 'EX', 604800);
  }
}
