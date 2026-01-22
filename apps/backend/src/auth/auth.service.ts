import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { LoginRequestDto } from '@costumes/shared';

interface tokenPayload {
  sub: number;
  login: string;
}
@Injectable()
export class AuthService {
  constructor(
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

  async refreshTokens(oldRefreshToken: string) {
    try {
      const result: tokenPayload =
        await this.jwtService.verifyAsync(oldRefreshToken);

      const user = await this.prisma.user.findUnique({
        where: { id: result.sub },
      });

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Invalid Credentials');
      }

      const isMatched = await argon2.verify(user.refreshToken, oldRefreshToken);

      if (!isMatched) {
        throw new UnauthorizedException('Invalid refresh token');
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
    } catch {
      throw new UnauthorizedException('Token expired or invalid');
    }
  }

  async logout(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
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
    const hashedToken = await argon2.hash(refreshToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedToken },
    });
  }
}
