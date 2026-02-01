import { Controller, Post, UseGuards } from '@nestjs/common';
import { VisitOrderService } from './visit-order.sevice';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';

@Controller('visits')
export class VisitController {
  constructor(private readonly visitOrderService: VisitOrderService) {}

  @Post('preview-code')
  @UseGuards(JwtAuthGuard)
  async PreviewCode(): Promise<string> {
    return await this.visitOrderService.generatePreviewCode();
  }
}
