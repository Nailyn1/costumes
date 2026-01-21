import { Controller, Post, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/auth.dto';
import { LoginSuccessResponseDto } from '@costumes/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login({
      login: dto.login,
      password: dto.password,
    });

    res.cookie(
      'refreshToken',
      result.refreshToken,
      this.authService.getCookieOptions(),
    );

    const response: LoginSuccessResponseDto = {
      accessToken: result.accessToken,
      user: result.user,
    };

    return response;
  }
}
