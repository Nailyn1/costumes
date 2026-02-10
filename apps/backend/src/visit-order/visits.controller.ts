import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { VisitOrderService } from './visit-order.sevice';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { CreateVisitRequest } from './dto/visit-order.dto';
import {
  CreateVisitResponseDto,
  OrdersNotWrittenResponseDto,
} from '@costumes/shared';

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

  @Get('not_written')
  @UseGuards(JwtAuthGuard)
  async getOrders(): Promise<OrdersNotWrittenResponseDto> {
    return await this.visitOrderService.findOrdersNotWritten();
  }

  @Post(':orderId/mark-tag-written')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteClient(@Param('orderId', ParseIntPipe) orderId: number) {
    await this.visitOrderService.orderMarkTagWritten(orderId);
  }
}
