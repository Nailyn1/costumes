import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CostumesService } from './costumes.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import {
  CreateCostumesRequest,
  UpdateCostumesRequest,
} from './dto/costumes.dto';
import {
  CostumesSearchAvailableResponseDto,
  CostumesSearchResponseDto,
  CreateUpdateCostumesResponseDto,
} from '@costumes/shared';

@Controller('costumes')
export class CostumesController {
  constructor(private readonly costumesService: CostumesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async costumeCreate(
    @Body() dto: CreateCostumesRequest,
  ): Promise<CreateUpdateCostumesResponseDto> {
    return this.costumesService.createCostume(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateCostume(
    @Param('id', ParseIntPipe) costumeId: number,
    @Body() dto: UpdateCostumesRequest,
  ): Promise<CreateUpdateCostumesResponseDto> {
    return await this.costumesService.updateCostume(dto, costumeId);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async searchCostume(
    @Query('q') q: string,
  ): Promise<CostumesSearchResponseDto[]> {
    if (!q || q.length < 2) return [];
    return await this.costumesService.searchCostume(q);
  }

  @Get('search-available')
  @UseGuards(JwtAuthGuard)
  async searchCostumeAvailable(
    @Query('q') q: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<CostumesSearchAvailableResponseDto[]> {
    return await this.costumesService.searchCostumeAvailable(
      q,
      startDate,
      endDate,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteClient(@Param('id', ParseIntPipe) costumeId: number) {
    await this.costumesService.deleteCostume(costumeId);
  }

  @Get(':costumeId/availability')
  @UseGuards(JwtAuthGuard)
  async costumesAvailability(
    @Param('costumeId', ParseIntPipe) costumeId: number,
  ) {
    return await this.costumesService.costumesAvailability(costumeId);
  }
}
