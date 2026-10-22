import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Req,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { VisitOrderService } from './visit-order.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RequestWithUser } from '../auth/active-user.interface';
import { VisitAuditActor } from './visit-order.service';
import {
  CompleteReturnRequest,
  CreateVisitRequest,
  MarkDepositReturnedRequest,
  VisitCancelRequest,
  VisitIssueRequest,
  VisitSettlementRequest,
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
  PaginatedUnsettledVisitBalancesResponseDto,
  searchNotificationDto,
  VisitBalanceDto,
  visitCompleteReturnResponseDto,
  visitIssuedResponseDto,
  visitNotificationResponseDto,
  visitUnreturnedDepositsResponseDto,
} from '@costumes/shared';

function auditActor(req: RequestWithUser): VisitAuditActor {
  const userId = Number(req.user.id);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new BadRequestException('В токене указан некорректный сотрудник');
  }
  return { source: 'user', userId };
}

@Controller('visits')
export class VisitController {
  constructor(private readonly visitOrderService: VisitOrderService) {}

  @Post('preview-code')
  @Header('Content-Type', 'application/json')
  @UseGuards(JwtAuthGuard)
  async PreviewCode(): Promise<string> {
    return JSON.stringify(await this.visitOrderService.generatePreviewCode());
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async CreateVisit(
    @Query('sendNotification', new DefaultValuePipe(true), ParseBoolPipe)
    sendNotification: boolean,
    @Body() dto: CreateVisitRequest,
    @Req() req: RequestWithUser,
  ): Promise<CreateVisitResponseDto> {
    return await this.visitOrderService.createVisit(
      dto,
      sendNotification,
      auditActor(req),
    );
  }

  @Get(':visitId/history')
  @UseGuards(JwtAuthGuard)
  async getVisitHistory(
    @Param('visitId', ParseIntPipe) visitId: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    return this.visitOrderService.visitHistory(visitId, page, limit);
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

  @Get('notification-search')
  @UseGuards(JwtAuthGuard)
  async searchNotification(
    @Query('q') q: string,
  ): Promise<searchNotificationDto[]> {
    if (!q || q.length < 2) {
      return [];
    }
    return await this.visitOrderService.searchNotification(q);
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
    @Req() req: RequestWithUser,
  ) {
    return await this.visitOrderService.visitIssue(
      dto,
      visitId,
      auditActor(req),
    );
  }

  @Post(':visitId/unissue')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async visitUnissue(
    @Param('visitId', ParseIntPipe) visitId: number,
    @Req() req: RequestWithUser,
  ) {
    return await this.visitOrderService.visitUnissue(visitId, auditActor(req));
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

  @Get('unsettled-balances')
  @UseGuards(JwtAuthGuard)
  async getUnsettledBalances(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ): Promise<PaginatedUnsettledVisitBalancesResponseDto> {
    return this.visitOrderService.listUnsettledVisitBalances(page, limit);
  }

  @Get(':visitId/balance')
  @UseGuards(JwtAuthGuard)
  async getBalance(
    @Param('visitId', ParseIntPipe) visitId: number,
  ): Promise<VisitBalanceDto> {
    return this.visitOrderService.getVisitBalance(visitId);
  }

  @Post(':visitId/settlement')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async settleVisit(
    @Param('visitId', ParseIntPipe) visitId: number,
    @Body() dto: VisitSettlementRequest,
    @Req() req: RequestWithUser,
  ): Promise<VisitBalanceDto> {
    return this.visitOrderService.settleVisit(visitId, dto, auditActor(req));
  }

  @Post(':orderId/mark-tag-written')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteClient(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Req() req: RequestWithUser,
  ) {
    await this.visitOrderService.orderMarkTagWritten(orderId, auditActor(req));
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
    @Req() req: RequestWithUser,
  ): Promise<MarkDepositReturnedDto> {
    return await this.visitOrderService.MarkDepositReturned(
      visitId,
      dto.notes,
      auditActor(req),
    );
  }

  @Post(':visitId/complete-return')
  @UseGuards(JwtAuthGuard)
  async completeReturn(
    @Param('visitId', ParseIntPipe) visitId: number,
    @Body() dto: CompleteReturnRequest,
    @Req() req: RequestWithUser,
  ): Promise<visitCompleteReturnResponseDto> {
    return await this.visitOrderService.visitCompleteReturn(
      visitId,
      dto,
      auditActor(req),
    );
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
  ): Promise<visitIssuedResponseDto> {
    return await this.visitOrderService.visitIssued(page, limit);
  }

  @Post(':visitId/cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async visitCancel(
    @Param('visitId', ParseIntPipe) visitId: number,
    @Body() dto: VisitCancelRequest,
    @Req() req: RequestWithUser,
  ) {
    return await this.visitOrderService.visitCancel(
      visitId,
      dto,
      auditActor(req),
    );
  }
}
