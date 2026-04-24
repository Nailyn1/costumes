import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { VisitOrderService } from './visit-order.sevice';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import {
  CompleteReturnRequest,
  CreateVisitRequest,
  MarkDepositReturnedRequest,
  VisitCancelRequest,
  VisitIssueRequest,
} from './dto/visit-order.dto';
import {
  CreateVisitResponseDto,
  GetVisitForIssueDto,
  GetVisitReservedDto,
  GetVisitReturnSearchDto,
  GetVisitSearchDto,
  GetVisitsForReturnDto,
  IssuedForReturnDto,
  MarkDepositReturnedDto,
  OrdersNotWrittenResponseDto,
  visitCompleteReturnResponseDto,
  visitIssuedRepsonseDto,
  visitNotificationResponseDto,
  visitUnreturnedDepositsResponseDto,
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
    @Query('sendNotification', new DefaultValuePipe(true), ParseBoolPipe)
    sendNotification: boolean,
    @Body() dto: CreateVisitRequest,
  ): Promise<CreateVisitResponseDto> {
    return await this.visitOrderService.createVisit(dto, sendNotification);
  }

  @Get('not_written')
  @UseGuards(JwtAuthGuard)
  async getOrders(): Promise<OrdersNotWrittenResponseDto> {
    return await this.visitOrderService.findOrdersNotWritten();
  }

  @Get('reserved')
  @UseGuards(JwtAuthGuard)
  async getReservedVisits(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ): Promise<GetVisitReservedDto> {
    return await this.visitOrderService.visitReserved(
      startDate,
      endDate,
      page,
      limit,
    );
  }

  @Get('notification')
  @UseGuards(JwtAuthGuard)
  async getVisitsNotification(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ): Promise<visitNotificationResponseDto> {
    return await this.visitOrderService.visitNotification(page, limit);
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

  @Post(':visitId/unissue')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async visitUnissue(@Param('visitId', ParseIntPipe) visitId: number) {
    return await this.visitOrderService.visitUnissue(visitId);
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

  @Post(':visitId/mark-deposit-returned')
  @UseGuards(JwtAuthGuard)
  async markDepositReturned(
    @Param('visitId', ParseIntPipe) visitId: number,
    @Body() dto: MarkDepositReturnedRequest,
  ): Promise<MarkDepositReturnedDto> {
    return await this.visitOrderService.MarkDepositReturned(visitId, dto.notes);
  }

  @Post(':visitId/complete-return')
  @UseGuards(JwtAuthGuard)
  async completeReturn(
    @Param('visitId', ParseIntPipe) visitId: number,
    @Body() dto: CompleteReturnRequest,
  ): Promise<visitCompleteReturnResponseDto> {
    return await this.visitOrderService.visitCompleteReturn(visitId, dto);
  }

  @Get('unreturned-deposits')
  @UseGuards(JwtAuthGuard)
  async unreturnedDeposits(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ): Promise<visitUnreturnedDepositsResponseDto> {
    return await this.visitOrderService.visitUnreturnedDeposits(page, limit);
  }

  @Get('issued')
  @UseGuards(JwtAuthGuard)
  async getIssuedVisits(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ): Promise<visitIssuedRepsonseDto> {
    return await this.visitOrderService.visitIssued(page, limit);
  }

  @Post(':visitId/cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async visitCancel(
    @Param('visitId', ParseIntPipe) visitId: number,
    @Body() dto: VisitCancelRequest,
  ) {
    return await this.visitOrderService.visitCancel(visitId, dto);
  }
}
