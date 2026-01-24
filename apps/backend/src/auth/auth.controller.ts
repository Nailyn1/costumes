import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/auth.dto';
import {
  LoginSuccessResponseDto,
  RefreshSuccessResponseDto,
} from '@costumes/shared';
import { JwtAuthGuard, JwtRefreshGuard } from './jwt/jwt-auth.guard';
import { RequestWithUser } from './active-user.interface';

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

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  async refresh(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { id, refreshToken } = req.user;

    const result = await this.authService.refreshTokens(
      Number(id),
      refreshToken as string,
    );

    res.cookie(
      'refreshToken',
      result.refreshToken,
      this.authService.getCookieOptions(),
    );

    const response: RefreshSuccessResponseDto = {
      accessToken: result.accessToken,
    };
    return response;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async logout(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(Number(req.user.id));
    res.clearCookie('refreshToken', this.authService.getCookieOptions());
    return;
  }
}
