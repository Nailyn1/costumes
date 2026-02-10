import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { VisitOrderService } from './visit-order.sevice';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { CreateVisitRequest } from './dto/visit-order.dto';
import { CreateVisitResponseDto } from '@costumes/shared';

@Controller('visits')
export class VisitController {
  constructor(private readonly visitOrderService: VisitOrderService) {}

  @Post('preview-code')
  @UseGuards(JwtAuthGuard)
  async PreviewCode(): Promise<string> {
    return await this.visitOrderService.generatePreviewCode();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async CreateVisit(
    @Body() dto: CreateVisitRequest,
  ): Promise<CreateVisitResponseDto> {
    return await this.visitOrderService.createVisit(dto);
  }
}
