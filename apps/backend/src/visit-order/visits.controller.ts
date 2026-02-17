import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { VisitOrderService } from './visit-order.sevice';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { CreateVisitRequest, VisitIssueRequest } from './dto/visit-order.dto';
import {
  CreateVisitResponseDto,
  GetVisitForIssueDto,
  GetVisitReservedDto,
  GetVisitReturnSearchDto,
  GetVisitSearchDto,
  GetVisitsForReturnDto,
  IssuedForReturnDto,
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

  @Get('reserved')
  @UseGuards(JwtAuthGuard)
  async getReservedVisits(
    @Query('date') date?: string,
  ): Promise<GetVisitReservedDto[]> {
    return await this.visitOrderService.visitReserved(date);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async searchVisits(@Query('q') q: string): Promise<GetVisitSearchDto[]> {
    if (!q || q.length < 2) {
      return [];
    }
    return await this.visitOrderService.visitSearch(q);
  }

  @Post(':visitId/issue')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async visitIssue(
    @Param('visitId', ParseIntPipe) visitId: number,
    @Body() dto: VisitIssueRequest,
  ) {
    return await this.visitOrderService.visitIssue(dto, visitId);
  }

  @Get(':visitId/for-issue')
  @UseGuards(JwtAuthGuard)
  async getVisitForIssue(
    @Param('visitId', ParseIntPipe) visitId: number,
  ): Promise<GetVisitForIssueDto> {
    return await this.visitOrderService.visitForIssue(visitId);
  }

  @Get('issued-for-return')
  @UseGuards(JwtAuthGuard)
  async getAllVisits(): Promise<IssuedForReturnDto[]> {
    return await this.visitOrderService.visitsIssuedForReturn();
  }

  @Post(':orderId/mark-tag-written')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteClient(@Param('orderId', ParseIntPipe) orderId: number) {
    await this.visitOrderService.orderMarkTagWritten(orderId);
  }

  @Get('return-search')
  @UseGuards(JwtAuthGuard)
  async visitsReturnSearch(
    @Query('q') q: string,
  ): Promise<GetVisitReturnSearchDto[]> {
    return await this.visitOrderService.visitsReturnSearch(q);
  }

  @Get(':visitId/for-return')
  @UseGuards(JwtAuthGuard)
  async visitForReturn(
    @Param('visitId', ParseIntPipe) visitId: number,
  ): Promise<GetVisitsForReturnDto> {
    return await this.visitOrderService.visitsForReturn(visitId);
  }
}
