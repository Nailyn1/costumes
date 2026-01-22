import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  UnauthorizedException,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenResponseDto } from './dto/auth.dto';
import { LoginSuccessResponseDto } from '@costumes/shared';
import { JwtAuthGuard } from './jwt-auth.guard';
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
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshTokenFromCookie = req.cookies['refreshToken'] as
      | string
      | undefined;

    if (!refreshTokenFromCookie) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const result = await this.authService.refreshTokens(refreshTokenFromCookie);

    res.cookie(
      'refreshToken',
      result.refreshToken,
      this.authService.getCookieOptions(),
    );

    const response: RefreshTokenResponseDto = {
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
