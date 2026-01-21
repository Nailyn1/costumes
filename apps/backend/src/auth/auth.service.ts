import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { LoginRequestDto } from '@costumes/shared';
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

    const payload = {
      sub: user.id,
      name: user.name,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });

    const refreshHashed = await argon2.hash(refreshToken, {
      type: argon2.argon2id,
    });

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        refreshToken: refreshHashed,
      },
    });

    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: {
        login: user.login,
        name: user.name,
      },
    };
  }

  // Генерация пары токенов
  private async issueTokens(userId: string, login: string) {
    const payload = { sub: userId, login };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: '15m', // Access живет недолго
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: '7d', // Refresh живет неделю
      }),
    ]);

    return { accessToken, refreshToken };
  }

  // Хешируем и сохраняем refresh токен в базу
  private async updateRefreshToken(userId: number, refreshToken: string) {
    const hashedToken = await argon2.hash(refreshToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedToken },
    });
  }
}
