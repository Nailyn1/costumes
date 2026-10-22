import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  VisitReadDetailDto,
  PaginatedVisitsResponseDto,
} from '@costumes/shared';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { VisitReadService } from './visit-read.service';

@Controller('visits')
@UseGuards(JwtAuthGuard)
export class VisitReadController {
  constructor(private readonly visitReadService: VisitReadService) {}

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('startDateFrom') startDateFrom?: string,
    @Query('startDateTo') startDateTo?: string,
    @Query('endDateFrom') endDateFrom?: string,
    @Query('endDateTo') endDateTo?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ): Promise<PaginatedVisitsResponseDto> {
    return this.visitReadService.list({
      ...(q === undefined ? {} : { q }),
      ...(status === undefined ? {} : { status }),
      ...(startDateFrom === undefined ? {} : { startDateFrom }),
      ...(startDateTo === undefined ? {} : { startDateTo }),
      ...(endDateFrom === undefined ? {} : { endDateFrom }),
      ...(endDateTo === undefined ? {} : { endDateTo }),
      page,
      limit,
    });
  }

  @Get(':visitId')
  async detail(
    @Param('visitId', ParseIntPipe) visitId: number,
  ): Promise<VisitReadDetailDto> {
    return this.visitReadService.detail(visitId);
  }
}
